# Lloyd's Deals Secure Admin Demo

This version does not use Supabase, Firebase, or external auth software.

It uses:
- Node.js built-in `http`
- Node.js built-in `crypto`
- JSON file storage
- Server-side password hashing with PBKDF2
- HttpOnly session cookies

## Run

1. Install Node.js.
2. Open terminal in this folder.
3. First run:

Windows PowerShell:
```powershell
$env:ADMIN_USER="sylex22"
$env:ADMIN_PASS="CHANGE_THIS_PASSWORD"
node server.js
```

Mac/Linux:
```bash
ADMIN_USER=sylex22 ADMIN_PASS='CHANGE_THIS_PASSWORD' node server.js
```

4. Open:
```text
http://localhost:3000
```

5. Admin:
```text
http://localhost:3000/admin/login
```

## Important

Do not use the password you posted publicly. Change it before going live.

The password is NOT stored in the frontend.
The server stores only a salted password hash in:
```text
data/admin.json
```

For production, host this on a VPS or Node hosting service and use HTTPS.
