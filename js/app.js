if(sessionStorage.getItem('ss_auth')!=='1')location.href='login.html';
let S=load(),charts={},F={q:'',c:'',s:'',sort:'name',page:0};
const LOC=['A1','A2','B1','B2','C1','C2','D1','D2'];
const $=s=>document.querySelector(s),money=n=>S.set.cur+Math.round(n).toLocaleString('en-IN'),today=()=>new Date().toISOString().slice(0,10);
let persistTimer;
const save=()=>{
  localStorage.setItem(KEY,JSON.stringify(S));
  // Persist the latest complete app state to MongoDB Atlas through the backend.
  clearTimeout(persistTimer);
  persistTimer=setTimeout(async()=>{
    try{
      const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(S)});
      if(!response.ok) console.error('MongoDB save failed:',await response.text());
    }catch(err){console.error('Could not reach backend; data remains in this browser:',err)}
  },250);
};
const prod=k=>S.products.find(p=>p.sku===k),supOf=p=>S.suppliers[p.sup]||{name:'—',lead:7,ontime:0};
const dl=p=>p.exp?Math.ceil((new Date(p.exp)-new Date(today()))/864e5):null;
const b=(l,c)=>`<span class="b ${c}">${l}</span>`;
const NAV=[['dashboard','▦','Dashboard'],['inventory','☰','Inventory'],['stock','⇅','Stock In / Out'],['reorder','⟳','Forecast & Reorder'],['expiry','⏱','Expiry Radar'],['warehouse','▣','Warehouse Map'],['orders','🧾','Purchase Orders'],['suppliers','🚚','Suppliers'],['analytics','📈','Analytics'],['notifications','🔔','Notifications'],['settings','⚙','Settings']];

/* ---------- business logic ---------- */
function st(p){const e=dl(p);
 if(e!==null&&e<=15)return{l:'Expiring Soon',c:e<=3?'crit':'warn',why:e<0?`Expired ${-e} day(s) ago`:`Expires in ${e} day(s)`};
 if(p.qty<=p.min/2)return{l:'Low Stock',c:'crit',why:`Critical: only ${p.qty} left, minimum is ${p.min}`};
 if(p.qty<=p.min)return{l:'Low Stock',c:'warn',why:`${p.qty} left, at or below minimum ${p.min}`};
 if(p.qty>p.min*4)return{l:'Overstocked',c:'info',why:`${p.qty} units is over 4x the minimum (${p.min})`};
 return{l:'Healthy',c:'ok',why:`${p.qty} units, comfortably above minimum ${p.min}`}}
const health=()=>Math.round(S.products.reduce((a,p)=>{const s=st(p);return a+(s.l==='Healthy'?100:s.l==='Overstocked'?70:s.l==='Expiring Soon'?50:s.c==='crit'?15:40)},0)/S.products.length);
function fc(p){const d=Math.max(p.daily,.1),days=Math.floor(p.qty/d),lead=supOf(p).lead;return{days,lead,out:new Date(Date.now()+days*864e5).toISOString().slice(0,10),by:Math.max(days-lead,0),rec:Math.max(p.re,Math.ceil(d*(lead+14))-p.qty)}}
const needs=p=>p.qty<=p.min||fc(p).days<=fc(p).lead+3;
const onOrder=k=>S.pos.some(o=>['Pending','Ordered'].includes(o.status)&&o.items.some(i=>i.sku===k));
const sold=k=>S.moves.filter(m=>m.sku===k&&m.type==='Sale').reduce((a,m)=>a-m.delta,0);
function move(sku,delta,type,reason,date){const p=prod(sku);if(!p)return'Product not found';if(!Number.isInteger(delta)||delta===0)return'Enter a valid whole quantity';if(p.qty+delta<0)return`Only ${p.qty} in stock — cannot go negative`;p.qty+=delta;S.moves.push({date:date||today(),sku,delta,type,reason});save();return''}
function alerts(){const a=[];S.products.forEach(p=>{const s=st(p),e=dl(p);if(s.l==='Low Stock')a.push({c:s.c,t:(s.c==='crit'?'Critical stock: ':'Low stock: ')+p.name,d:s.why,sku:p.sku});if(e!==null&&e<=15)a.push({c:s.c,t:'Expiring: '+p.name,d:s.why,sku:p.sku})});S.pos.filter(o=>o.status==='Pending').forEach(o=>a.push({c:'info',t:'Pending purchase order '+o.id,d:S.suppliers[o.sup].name,po:1}));return a}

/* ---------- UI helpers ---------- */
function toast(m,t=''){const e=$('#toast');e.textContent=m;e.className='show '+t;setTimeout(()=>e.className='',2600)}
function modal(t,h){$('#modal').innerHTML=`<div class="box"><h3>${t}</h3>${h}</div>`;$('#modal').classList.add('open')}
const closeModal=()=>$('#modal').classList.remove('open');
const card=(l,v,c='')=>`<div class="card ${c}"><small>${l}</small><b>${v}</b></div>`;
const fi=(id,l,v,t='text')=>`<div><label>${l}</label><input id="${id}" type="${t}" value="${v}"></div>`;
const sel=(id,l,opts,v)=>`<div><label>${l}</label><select id="${id}">${opts.map(o=>`<option value="${o[0]}" ${o[0]==v?'selected':''}>${o[1]}</option>`).join('')}</select></div>`;
function chart(id,cfg){if(charts[id])charts[id].destroy();charts[id]=new Chart($('#'+id),cfg)}
function timeline(n){const r=[...S.moves].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n);return`<div class="tl">${r.map(m=>`<div class="${m.delta<0?'neg':''}"><b>${prod(m.sku)?.name||m.sku}</b> <b style="color:var(--${m.delta<0?'crit':'ok'})">${m.delta>0?'+':''}${m.delta}</b><br><small>${m.type} · ${m.reason} · ${m.date}</small></div>`).join('')}</div>`}
function theme(){S.set.theme=S.set.theme==='dark'?'light':'dark';save();document.documentElement.dataset.theme=S.set.theme;route()}
function toggleNav(){innerWidth<900?document.body.classList.toggle('open'):document.body.classList.toggle('collapsed')}
function csv(){const rows=[['SKU','Name','Category','Qty','Unit Price','Supplier','Location','Min Stock','Reorder Qty','Expiry'],...S.products.map(p=>[p.sku,p.name,p.cat,p.qty,p.price,supOf(p).name,p.loc,p.min,p.re,p.exp])];const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')],{type:'text/csv'}));a.download='inventory.csv';a.click();toast('CSV exported')}

/* ---------- views ---------- */
function dashboard(){const P=S.products,val=P.reduce((a,p)=>a+p.qty*p.price,0),low=P.filter(p=>st(p).l==='Low Stock').length,ex=P.filter(p=>st(p).l==='Expiring Soon').length;
 const r=P.filter(needs),f=[...P].sort((a,b)=>fc(a).days-fc(b).days)[0],e=P.filter(p=>p.exp).sort((a,b)=>a.exp.localeCompare(b.exp))[0],o=P.filter(p=>st(p).l==='Overstocked');
 $('#view').innerHTML=`<h1>Dashboard <small>· ${S.set.biz}</small></h1><div class="cards">${card('Total Products',P.length)}${card('Inventory Value',money(val))}${card('Low Stock Items',low,'crit')}${card('Expiring Products',ex,'warn')}</div>
 <div class="grid"><div class="panel"><h3>Inventory Health Score</h3><div class="score">${health()}<small>/100</small></div><canvas id="c1"></canvas></div><div class="panel"><h3>Stock Value by Category</h3><canvas id="c2"></canvas></div>
 <div class="panel wide"><h3>Units sold — last 14 days</h3><canvas id="c3"></canvas></div>
 <div class="panel"><h3>Smart Insights</h3><ul class="ins"><li>🔁 <b>${r.length}</b> products need reordering. <a href="#reorder">Open assistant</a></li><li>⏳ <b>${f.name}</b> may run out in ~${fc(f).days} day(s) <small>(demo estimate)</small></li>${e?`<li>🥛 FEFO: sell <b>${e.name}</b> first — expires ${e.exp}</li>`:''}<li>📦 ${o.length} overstocked product(s) hold ${money(o.reduce((a,p)=>a+p.qty*p.price,0))} of cash</li></ul><h3 style="margin-top:16px">Low-stock Alerts</h3>${alerts().filter(a=>a.sku&&a.t.includes('tock')).slice(0,4).map(a=>`<div style="padding:4px 0">${b(a.c==='crit'?'Critical':'Low',a.c)} ${a.t.split(': ')[1]}</div>`).join('')}</div>
 <div class="panel"><h3>Recent Activity</h3>${timeline(7)}</div></div>`;
 const cnt={};P.forEach(p=>{const l=st(p).l;cnt[l]=(cnt[l]||0)+1});
 chart('c1',{type:'doughnut',data:{labels:Object.keys(cnt),datasets:[{data:Object.values(cnt),backgroundColor:['#12B76A','#EF4444','#6366F1','#F59E0B']}]},options:{plugins:{legend:{position:'right'}}}});
 const cv={};P.forEach(p=>cv[p.cat]=(cv[p.cat]||0)+p.qty*p.price);
 chart('c2',{type:'bar',data:{labels:Object.keys(cv),datasets:[{label:'Value',data:Object.values(cv),backgroundColor:'#4263EB',borderRadius:6}]},options:{plugins:{legend:{display:false}}}});
 const days=[...Array(14)].map((_,i)=>new Date(Date.now()-(13-i)*864e5).toISOString().slice(0,10));
 chart('c3',{type:'line',data:{labels:days.map(d=>d.slice(5)),datasets:[{label:'Units sold',data:days.map(d=>S.moves.filter(m=>m.date===d&&m.type==='Sale').reduce((a,m)=>a-m.delta,0)),borderColor:'#4263EB',backgroundColor:'#4263EB22',fill:true,tension:.35}]},options:{plugins:{legend:{display:false}}}})}

function filtered(){const q=F.q.toLowerCase();return S.products.filter(p=>(!q||(p.name+p.sku+p.cat).toLowerCase().includes(q))&&(!F.c||p.cat===F.c)&&(!F.s||st(p).l===F.s)).sort((a,b)=>F.sort==='qty'?a.qty-b.qty:F.sort==='price'?b.price-a.price:F.sort==='value'?b.qty*b.price-a.qty*a.price:a.name.localeCompare(b.name))}
function inventory(){const cats=[...new Set(S.products.map(p=>p.cat))];
 $('#view').innerHTML=`<h1>Inventory</h1><div class="bar"><input placeholder="Search name, SKU, category" value="${F.q}" oninput="F.q=this.value;F.page=0;drawTable()"><select onchange="F.c=this.value;F.page=0;drawTable()"><option value="">All categories</option>${cats.map(c=>`<option ${F.c===c?'selected':''}>${c}</option>`).join('')}</select><select onchange="F.s=this.value;F.page=0;drawTable()"><option value="">All statuses</option>${['Healthy','Low Stock','Overstocked','Expiring Soon'].map(c=>`<option ${F.s===c?'selected':''}>${c}</option>`).join('')}</select><select onchange="F.sort=this.value;drawTable()"><option value="name">Sort: Name</option><option value="qty">Sort: Qty (low first)</option><option value="price">Sort: Price</option><option value="value">Sort: Value</option></select><button class="ib" onclick="csv()">⬇ CSV</button><button class="btn" onclick="pform()">+ Add Product</button></div>
 <div class="panel tw"><table><thead><tr><th>SKU</th><th>Product</th><th>Qty</th><th>Price</th><th>Location</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody id="tb"></tbody></table><div class="bar" style="margin:12px 0 0;justify-content:flex-end;align-items:center"><small id="pg"></small><button class="ib" onclick="F.page--;drawTable()">‹ Prev</button><button class="ib" onclick="F.page++;drawTable()">Next ›</button></div></div>`;drawTable()}
function drawTable(){const r=filtered(),pages=Math.max(1,Math.ceil(r.length/10));F.page=Math.min(Math.max(F.page,0),pages-1);
 $('#tb').innerHTML=r.slice(F.page*10,F.page*10+10).map(p=>{const s=st(p);return`<tr><td>${p.sku}</td><td><b>${p.name}</b><br><small>${p.cat}</small></td><td>${p.qty}</td><td>${money(p.price)}</td><td>${p.loc}</td><td>${p.exp||'—'}</td><td>${b(s.l,s.c)}</td><td class="act"><button onclick="view('${p.sku}')">View</button><button onclick="pform('${p.sku}')">Edit</button><button class="del" onclick="delProd('${p.sku}')">Delete</button></td></tr>`}).join('')||`<tr><td colspan="8" class="empty">📭 No products match your filters</td></tr>`;
 $('#pg').textContent=`Page ${F.page+1} of ${pages} · ${r.length} items`}
function view(k){const p=prod(k),s=st(p),f=fc(p);modal(p.name,`<p>${b(s.l,s.c)} <small>${s.why}</small></p><div class="kv">SKU<b>${p.sku}</b>Category<b>${p.cat}</b>Quantity<b>${p.qty}</b>Unit price<b>${money(p.price)}</b>Stock value<b>${money(p.qty*p.price)}</b>Supplier<b>${supOf(p).name}</b>Location<b>${p.loc}</b>Min / Reorder qty<b>${p.min} / ${p.re}</b>Expiry<b>${p.exp||'—'}</b>Est. stockout<b>${f.out} (~${f.days} days)</b></div><div class="right"><button class="btn" onclick="closeModal()">Close</button></div>`)}
function pform(k){const p=k?prod(k):{sku:'',name:'',cat:'',qty:0,price:'',sup:0,loc:'A1',min:S.set.low,re:20,exp:'',daily:1};
 modal(k?'Edit Product':'Add Product',`<div class="fg">${fi('f_sku','SKU',p.sku)}${fi('f_name','Name',p.name)}${fi('f_cat','Category',p.cat)}${fi('f_qty','Quantity',p.qty,'number')}${fi('f_price','Unit price',p.price,'number')}${sel('f_sup','Supplier',S.suppliers.map(s=>[s.id,s.name]),p.sup)}${sel('f_loc','Warehouse location',LOC.map(l=>[l,l]),p.loc)}${fi('f_min','Minimum stock',p.min,'number')}${fi('f_re','Reorder quantity',p.re,'number')}${fi('f_exp','Expiry date',p.exp,'date')}${fi('f_daily','Avg daily sales (demo)',p.daily,'number')}</div><p class="err" id="ferr"></p><div class="right"><button class="ib" onclick="closeModal()">Cancel</button> <button class="btn" onclick="saveProd('${k||''}')">Save</button></div>`)}
function saveProd(old){const g=i=>$('#f_'+i).value.trim();const o={sku:g('sku').toUpperCase(),name:g('name'),cat:g('cat'),qty:+g('qty'),price:+g('price'),sup:+g('sup'),loc:g('loc'),min:+g('min'),re:+g('re'),exp:g('exp'),daily:+g('daily')||0};
 const e=!o.sku||!o.name||!o.cat?'SKU, name and category are required':!Number.isInteger(o.qty)||o.qty<0?'Quantity must be a whole number ≥ 0':!(o.price>0)?'Unit price must be greater than 0':o.min<0||o.re<1?'Check minimum stock and reorder quantity':S.products.some(p=>p.sku===o.sku&&p.sku!==old)?'SKU already exists':'';
 if(e)return $('#ferr').textContent=e;
 if(old){const p=prod(old),dq=o.qty-p.qty;Object.assign(p,o);if(dq)S.moves.push({date:today(),sku:o.sku,delta:dq,type:'Adjustment',reason:'Manual edit'})}else{S.products.push(o);if(o.qty)S.moves.push({date:today(),sku:o.sku,delta:o.qty,type:'Stock In',reason:'Opening stock'})}
 save();closeModal();toast(old?'Product updated':'Product added');route()}
function delProd(k){if(confirm('Delete '+prod(k).name+'? This cannot be undone.')){S.products=S.products.filter(p=>p.sku!==k);save();toast('Product deleted');route()}}

function stock(){$('#view').innerHTML=`<h1>Stock In / Out</h1><div class="grid"><div class="panel"><h3>Record transaction</h3><div class="fg">${sel('s_sku','Product',S.products.map(p=>[p.sku,`${p.name} (${p.qty})`]),'')}${sel('s_type','Type',['Stock In','Stock Out','Return','Adjustment'].map(t=>[t,t]),'')}${fi('s_qty','Quantity (Adjustment: use − to reduce)','','number')}${fi('s_date','Date',today(),'date')}</div><label><small>Notes</small></label><input id="s_note" placeholder="Reason / notes"><p class="err" id="serr"></p><button class="btn" onclick="doStock()">Record</button></div><div class="panel"><h3>Stock Movement Timeline</h3>${timeline(14)}</div></div>`}
function doStock(){const t=$('#s_type').value,q=parseInt($('#s_qty').value);if(!q||(t!=='Adjustment'&&q<0))return $('#serr').textContent='Enter a valid quantity';
 const e=move($('#s_sku').value,t==='Stock Out'?-q:q,t,$('#s_note').value.trim()||t,$('#s_date').value||today());if(e)return $('#serr').textContent=e;toast('Transaction recorded');route()}

function reorder(){$('#view').innerHTML=`<h1>Forecast & Reorder Assistant</h1><p><small>⚠ Demo estimates based on sample sales data (average daily sales) — not real AI.</small></p><div class="panel tw"><table><thead><tr><th>Product</th><th>Qty</th><th>Daily sales</th><th>Days left</th><th>Stockout</th><th>Reorder by</th><th>Reorder qty</th><th>Supplier</th><th></th></tr></thead><tbody>${[...S.products].sort((a,b)=>fc(a).days-fc(b).days).map(p=>{const f=fc(p),n=needs(p);return`<tr><td><b>${p.name}</b></td><td>${p.qty}</td><td>${p.daily}</td><td>${b(f.days+' d',f.days<=f.lead?'crit':f.days<=f.lead+7?'warn':'ok')}</td><td>${f.out}</td><td>${n?'<b>Now</b>':'in '+f.by+' d'}</td><td>${n?f.rec:'—'}</td><td>${supOf(p).name}<br><small>${f.lead}d lead</small></td><td>${n?(onOrder(p.sku)?b('On order','info'):`<button class="ib" onclick="createPO('${p.sku}')">Create PO</button>`):''}</td></tr>`}).join('')}</tbody></table></div>`}
function createPO(k){const p=prod(k),id='PO-'+(1001+S.pos.length);S.pos.push({id,sup:p.sup,date:today(),status:'Pending',applied:false,items:[{sku:k,qty:fc(p).rec,price:Math.round(p.price*.8)}]});save();toast(id+' created');route()}

function expiry(){const P=S.products.filter(p=>p.exp).sort((a,b)=>a.exp.localeCompare(b.exp)),n=x=>P.filter(p=>dl(p)<=x).length;
 $('#view').innerHTML=`<h1>Expiry Radar</h1><div class="cards">${card('Within 7 days',n(7),'crit')}${card('Within 15 days',n(15),'warn')}${card('Within 30 days',n(30))}</div><div class="panel tw"><h3>FEFO — sell in this order (First Expired, First Out)</h3><table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Expiry</th><th>Days left</th><th>Advice</th></tr></thead><tbody>${P.map((p,i)=>{const e=dl(p);return`<tr><td>${i+1}</td><td><b>${p.name}</b></td><td>${p.qty}</td><td>${p.exp}</td><td>${b(e+' d',e<=7?'crit':e<=15?'warn':e<=30?'info':'ok')}</td><td>${e<=7?'Sell first / discount now':e<=30?'Prioritise at counter':'Normal rotation'}</td></tr>`}).join('')}</tbody></table></div>`}

function warehouse(){const zone=l=>{const w=S.products.filter(p=>p.loc===l).map(p=>st(p).c);return w.includes('crit')?'crit':w.includes('warn')?'warn':'ok'};
 $('#view').innerHTML=`<h1>Warehouse Map</h1><div class="legend"><span><i style="background:var(--ok)"></i>Normal</span><span><i style="background:var(--warn)"></i>Low</span><span><i style="background:var(--crit)"></i>Critical</span></div><div class="grid"><div class="panel"><div class="map">${LOC.map(l=>`<button class="shelf ${zone(l)}" onclick="showShelf('${l}')"><b>${l}</b><small>${S.products.filter(p=>p.loc===l).length} products</small></button>`).join('')}</div></div><div class="panel" id="shelfinfo"><p class="empty">👆 Click a shelf to see its products</p></div></div>`}
function showShelf(l){const r=S.products.filter(p=>p.loc===l);$('#shelfinfo').innerHTML=`<h3>Shelf ${l}</h3>${r.map(p=>`<div style="padding:7px 0;border-bottom:1px solid var(--bd)"><b>${p.name}</b> — ${p.qty} units ${b(st(p).l,st(p).c)}</div>`).join('')||'<p class="empty">Empty shelf</p>'}`}

function orders(){$('#view').innerHTML=`<h1>Purchase Orders</h1><div class="bar"><button class="btn" onclick="poForm()">+ New Purchase Order</button></div><div class="panel tw"><table><thead><tr><th>PO</th><th>Supplier</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th></tr></thead><tbody>${[...S.pos].reverse().map(o=>{const lock=['Received','Cancelled'].includes(o.status);return`<tr><td><b>${o.id}</b></td><td>${S.suppliers[o.sup].name}</td><td>${o.items.map(i=>`${prod(i.sku)?.name||i.sku} ×${i.qty}`).join('<br>')}</td><td>${money(o.items.reduce((a,i)=>a+i.qty*i.price,0))}</td><td>${o.date}</td><td><select ${lock?'disabled':''} onchange="setPO('${o.id}',this.value)" style="width:130px">${['Pending','Ordered','Received','Cancelled'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`}).join('')}</tbody></table></div>`}
function setPO(id,s){const o=S.pos.find(x=>x.id===id);if(['Received','Cancelled'].includes(o.status))return;if(s==='Received'&&!o.applied){o.items.forEach(i=>move(i.sku,i.qty,'Stock In','Received '+id));o.applied=true}o.status=s;save();toast(`${id} marked ${s}`);route()}
function poForm(){modal('New Purchase Order',`<div class="fg">${sel('o_sku','Product',S.products.map(p=>[p.sku,p.name]),'')}${fi('o_qty','Quantity',20,'number')}${fi('o_price','Unit price',100,'number')}</div><p class="err" id="oerr"></p><div class="right"><button class="ib" onclick="closeModal()">Cancel</button> <button class="btn" onclick="savePO()">Create</button></div>`)}
function savePO(){const q=parseInt($('#o_qty').value),pr=+$('#o_price').value;if(!(q>0)||!(pr>0))return $('#oerr').textContent='Quantity and price must be greater than 0';const p=prod($('#o_sku').value);S.pos.push({id:'PO-'+(1001+S.pos.length),sup:p.sup,date:today(),status:'Pending',applied:false,items:[{sku:p.sku,qty:q,price:pr}]});save();closeModal();toast('Purchase order created');route()}

function suppliers(){$('#view').innerHTML=`<h1>Suppliers</h1><div class="panel tw"><table><thead><tr><th>Supplier</th><th>Contact</th><th>Products</th><th>Lead time</th><th>On-time delivery (sample)</th></tr></thead><tbody>${S.suppliers.map(s=>`<tr><td><b>${s.name}</b></td><td>${s.phone}</td><td>${S.products.filter(p=>p.sup===s.id).length}</td><td>${s.lead} days</td><td>${b(s.ontime+'%',s.ontime>=90?'ok':'warn')}</td></tr>`).join('')}</tbody></table></div>`}

function analytics(){const cats=[...new Set(S.products.map(p=>p.cat))],P=S.products.filter(p=>!F.c||p.cat===F.c).map(p=>({p,u:sold(p.sku)})).sort((a,b)=>b.u-a.u);
 const list=a=>a.map(x=>`<div style="padding:5px 0">${x.p.name} <small>— ${x.u} sold</small></div>`).join('');
 $('#view').innerHTML=`<h1>Analytics & Reports</h1><div class="bar"><select onchange="F.c=this.value;analytics()"><option value="">All categories</option>${cats.map(c=>`<option ${F.c===c?'selected':''}>${c}</option>`).join('')}</select><button class="ib" onclick="csv()">⬇ Export CSV</button></div><div class="cards">${card('Inventory value',money(P.reduce((a,x)=>a+x.p.qty*x.p.price,0)))}${card('Units sold (14d)',P.reduce((a,x)=>a+x.u,0))}</div><div class="grid"><div class="panel wide"><h3>Units sold per product (14 days)</h3><canvas id="c4"></canvas></div><div class="panel"><h3>🚀 Fast-moving</h3>${list(P.slice(0,5))}</div><div class="panel"><h3>🐢 Slow-moving</h3>${list(P.slice(-5).reverse())}</div></div>`;
 chart('c4',{type:'bar',data:{labels:P.map(x=>x.p.name),datasets:[{data:P.map(x=>x.u),backgroundColor:'#4263EB',borderRadius:5}]},options:{plugins:{legend:{display:false}}}})}

function notifications(){const a=alerts();$('#view').innerHTML=`<h1>Notifications</h1><div class="panel">${a.map(x=>`<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--bd)">${b(x.c==='crit'?'Critical':x.c==='warn'?'Warning':'Info',x.c)}<div style="flex:1"><b>${x.t}</b><br><small>${x.d}</small></div><button class="ib" onclick="${x.sku?`view('${x.sku}')`:`location.hash='#orders'`}">View</button></div>`).join('')||'<p class="empty">🎉 All clear</p>'}</div>`}

function settings(){$('#view').innerHTML=`<h1>Settings</h1><div class="panel" style="max-width:520px"><div class="fg">${fi('t_biz','Business name',S.set.biz)}${fi('t_cur','Currency symbol',S.set.cur)}${fi('t_low','Default minimum stock',S.set.low,'number')}${sel('t_th','Theme',[['light','Light'],['dark','Dark']],S.set.theme)}</div><button class="btn" onclick="saveSet()">Save settings</button> <button class="btn red" onclick="if(confirm('Reset ALL data to demo data?')){S=seed();save();toast('Demo data restored');route()}">Reset demo data</button></div>`}
function saveSet(){S.set={biz:$('#t_biz').value.trim()||'My Store',cur:$('#t_cur').value.trim()||'₹',low:+$('#t_low').value||10,theme:$('#t_th').value};save();document.documentElement.dataset.theme=S.set.theme;toast('Settings saved');route()}

/* ---------- router ---------- */
const V={dashboard,inventory,stock,reorder,expiry,warehouse,orders,suppliers,analytics,notifications,settings};
function route(){const v=(location.hash||'#dashboard').slice(1);document.documentElement.dataset.theme=S.set.theme;document.body.classList.remove('open');closeModal();
 Chart.defaults.color=getComputedStyle(document.body).getPropertyValue('--mu');
 $('#nav').innerHTML=NAV.map(n=>`<a href="#${n[0]}" class="${n[0]===v?'on':''}"><span>${n[1]}</span><span class="lbl">${n[2]}</span></a>`).join('');
 $('#date').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
 $('#bell').textContent=alerts().length;(V[v]||dashboard)()}
addEventListener('hashchange',route);
async function bootstrap(){
  try{
    const response=await fetch('/api/state');
    if(!response.ok) throw new Error('API returned '+response.status);
    const result=await response.json();
    if(result.state){
      S=result.state;
      localStorage.setItem(KEY,JSON.stringify(S));
    }else{
      // First run: seed the database with the existing demo data.
      await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(S)});
    }
    const status=$('#db-status');
    if(status) status.textContent='MongoDB Atlas connected';
  }catch(err){
    console.warn('MongoDB backend unavailable; using browser data.',err);
    const status=$('#db-status');
    if(status) status.textContent='Offline mode (browser storage)';
  }
  route();
}
bootstrap();
