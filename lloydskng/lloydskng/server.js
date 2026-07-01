const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const querystring = require("querystring");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_FILE = path.join(DATA_DIR, "db.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    settings: {
      siteName: "Lloyd's Deals",
      officialStoreUrl: "https://storee.kngestate.com",
      footer: "Lloyd's Deals is an independent deal guide and is not the official KNG store."
    },
    categories: [],
    deals: [],
    announcements: []
  }, null, 2));
}

const sessions = new Map();

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
  });
}

function getCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(c => {
    const [k, ...v] = c.trim().split("=");
    return [k, decodeURIComponent(v.join("="))];
  }));
}

function isAdmin(req) {
  const sid = getCookies(req).sid;
  return sid && sessions.has(sid);
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    json(res, 401, { error: "Not logged in" });
    return false;
  }
  return true;
}

function loadDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 200000, 64, "sha512").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, admin) {
  const attempt = hashPassword(password, admin.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(attempt, "hex"), Buffer.from(admin.hash, "hex"));
}

function setupAdminIfNeeded() {
  if (fs.existsSync(ADMIN_FILE)) return;
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASS;

  if (!username || !password) {
    console.log("\nFIRST RUN SETUP REQUIRED");
    console.log("Run this once with:");
    console.log("ADMIN_USER=sylex22 ADMIN_PASS='your-new-password' node server.js\n");
    process.exit(1);
  }

  const secure = hashPassword(password);
  fs.writeFileSync(ADMIN_FILE, JSON.stringify({
    username,
    salt: secure.salt,
    hash: secure.hash,
    createdAt: new Date().toISOString()
  }, null, 2));

  console.log("Admin account created. Password was hashed server-side.");
}

function serveFile(req, res) {
  let filePath = req.url.split("?")[0];
  if (filePath === "/") filePath = "/index.html";
  if (filePath === "/admin") filePath = "/admin.html";
  if (filePath === "/admin/login") filePath = "/login.html";

  const full = path.join(PUBLIC_DIR, path.normalize(filePath));
  if (!full.startsWith(PUBLIC_DIR)) return json(res, 403, { error: "Forbidden" });

  fs.readFile(full, (err, data) => {
    if (err) return json(res, 404, { error: "Not found" });
    const ext = path.extname(full);
    const type = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".png": "image/png",
      ".jpg": "image/jpeg"
    }[ext] || "text/plain";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/public" && req.method === "GET") {
    const db = loadDb();
    return json(res, 200, {
      settings: db.settings,
      categories: db.categories.filter(c => c.live),
      deals: db.deals.filter(d => d.live),
      announcements: db.announcements.filter(a => a.live)
    });
  }

  if (url.pathname === "/api/login" && req.method === "POST") {
    const body = querystring.parse(await readBody(req));
    const admin = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf8"));

    if (body.username === admin.username && verifyPassword(body.password || "", admin)) {
      const sid = crypto.randomBytes(32).toString("hex");
      sessions.set(sid, { username: admin.username, createdAt: Date.now() });
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    return json(res, 401, { error: "Invalid login" });
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const sid = getCookies(req).sid;
    if (sid) sessions.delete(sid);
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (url.pathname === "/api/admin" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    return json(res, 200, loadDb());
  }

  if (url.pathname === "/api/admin/save" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const body = await readBody(req);
    try {
      const db = JSON.parse(body);
      saveDb(db);
      return json(res, 200, { ok: true });
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }
  }

  return json(res, 404, { error: "API route not found" });
}

setupAdminIfNeeded();

http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) return handleApi(req, res);
  serveFile(req, res);
}).listen(PORT, () => {
  console.log(`Lloyd's Deals running on http://localhost:${PORT}`);
});