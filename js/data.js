// Sample data + LocalStorage helpers
const KEY='stocksense_v1';
function seed(){
const d=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
const suppliers=[['TechSource Ltd',7,'+91 98400 11001',96],['FreshFarm Foods',2,'+91 98400 22002',91],['PaperWorks Co',5,'+91 98400 33003',88],['HomeCare Traders',4,'+91 98400 44004',94],['StyleHub Apparel',9,'+91 98400 55005',82]].map((s,i)=>({id:i,name:s[0],lead:s[1],phone:s[2],ontime:s[3]}));
// sku,name,category,qty,price,supplier,location,min,reorderQty,expiryInDays,avgDailySales
const raw=[['EL-001','Wireless Mouse','Electronics',42,799,0,'A1',15,40,null,3],['EL-002','USB-C Cable','Electronics',8,299,0,'A1',20,60,null,4],['EL-003','Bluetooth Speaker','Electronics',25,2499,0,'A2',10,20,null,1],['EL-004','Power Bank 10000mAh','Electronics',5,1499,0,'A2',12,30,null,2],
['GR-001','Basmati Rice 5kg','Groceries',60,620,1,'B1',20,50,120,5],['GR-002','Fresh Milk 1L','Groceries',18,56,1,'B1',30,100,4,14],['GR-003','Whole Wheat Bread','Groceries',22,45,1,'B1',15,40,6,9],['GR-004','Cheddar Cheese 200g','Groceries',30,210,1,'B2',10,25,12,2],['GR-005','Orange Juice 1L','Groceries',70,110,1,'B2',20,50,25,3],['GR-006','Instant Noodles Pack','Groceries',200,14,1,'B2',40,150,90,6],
['ST-001','A4 Notebook','Stationery',120,60,2,'C1',40,100,null,8],['ST-002','Ball Pen Blue (10pk)','Stationery',15,90,2,'C1',30,80,null,5],['ST-003','Highlighter Set','Stationery',48,150,2,'C1',15,30,null,1],['ST-004','A4 Paper Ream','Stationery',9,380,2,'C2',20,50,null,3],
['CL-001','Cotton T-Shirt','Clothing',55,499,4,'D1',20,40,null,2],['CL-002','Denim Jeans','Clothing',30,1299,4,'D1',10,25,null,1],['CL-003','College Hoodie','Clothing',12,999,4,'D2',10,30,null,1],
['HH-001','Dish Wash Liquid 500ml','Household',44,95,3,'C2',20,50,200,3],['HH-002','Floor Cleaner 1L','Household',75,180,3,'C2',20,40,300,2],['HH-003','LED Bulb 9W','Household',150,120,3,'D2',40,100,null,4],['HH-004','Hand Sanitizer 500ml','Household',6,220,3,'C2',15,40,45,3]];
const products=raw.map(r=>({sku:r[0],name:r[1],cat:r[2],qty:r[3],price:r[4],sup:r[5],loc:r[6],min:r[7],re:r[8],exp:r[9]==null?'':d(r[9]),daily:r[10]}));
const moves=[];
products.forEach((p,i)=>{for(let k=13;k>=0;k--){const q=Math.max(0,p.daily+((k*7+i*3)%3)-1);if(q)moves.push({date:d(-k),sku:p.sku,delta:-q,type:'Sale',reason:'Customer sales'})}});
moves.push({date:d(-3),sku:'EL-001',delta:20,type:'Stock In',reason:'Supplier delivery PO-1001'},{date:d(-2),sku:'CL-001',delta:2,type:'Return',reason:'Customer return'},{date:d(-1),sku:'GR-003',delta:-2,type:'Adjustment',reason:'Damaged items'});
const pos=[{id:'PO-1001',sup:0,date:d(-10),status:'Received',applied:true,items:[{sku:'EL-001',qty:20,price:650}]},{id:'PO-1002',sup:1,date:d(-2),status:'Ordered',applied:false,items:[{sku:'GR-002',qty:100,price:48}]},{id:'PO-1003',sup:2,date:d(0),status:'Pending',applied:false,items:[{sku:'ST-004',qty:50,price:320}]},{id:'PO-1004',sup:4,date:d(-6),status:'Cancelled',applied:false,items:[{sku:'CL-003',qty:30,price:800}]}];
return{products,suppliers,moves,pos,set:{biz:'StockSense Demo Store',cur:'₹',theme:'light',low:10}}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.products)return s}catch(e){}const s=seed();localStorage.setItem(KEY,JSON.stringify(s));return s}
