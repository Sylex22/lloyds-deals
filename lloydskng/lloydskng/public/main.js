let DB={deals:[],categories:[],announcements:[],settings:{}};
fetch('/api/public').then(r=>r.json()).then(d=>{DB=d;render();});
function money(n){return '£'+Number(n||0).toLocaleString('en-GB')}
function off(o,c){o=Number(o||0);c=Number(c||0);return o>c?Math.round(((o-c)/o)*100):0}
function cat(id){return (DB.categories.find(c=>c.id===id)||{}).name||'No category'}
function render(){
 document.getElementById('ann').innerHTML=DB.announcements.map(a=>`<div class="banner"><b>${a.title}</b> ${a.message}</div>`).join('');
 document.getElementById('deals').innerHTML=DB.deals.length?DB.deals.map(d=>`<div class="card"><span class="tag">${cat(d.category_id)}</span><h3>${d.title}</h3><p>${d.short_description||''}</p><div><span class="price">${money(d.current_price)}</span> <span class="old">${money(d.old_price)}</span> <span class="tag">${off(d.old_price,d.current_price)}% OFF</span></div><p>${(d.tags||'').split(',').map(t=>`<span class="tag">${t.trim()}</span>`).join('')}</p></div>`).join(''):'<p>No deals added yet.</p>';
}
function findDeals(){
 const q=document.getElementById('q').value.toLowerCase(); const budget=(q.match(/\d+/)||[])[0];
 const terms=q.split(/\s+/).filter(x=>x.length>2);
 let scored=DB.deals.map(d=>{let text=[d.title,d.short_description,d.full_description,d.tags,d.best_for,cat(d.category_id)].join(' ').toLowerCase();let score=0;terms.forEach(t=>{if(text.includes(t))score+=5});if(budget&&Number(d.current_price)<=Number(budget))score+=10;score+=off(d.old_price,d.current_price)/10;return{d,score}}).sort((a,b)=>b.score-a.score).slice(0,3);
 document.getElementById('ai').innerHTML=scored.map(x=>`<div class="card"><b>${x.d.title}</b><p>Recommended because it matches your search and costs ${money(x.d.current_price)}.</p></div>`).join('');
}