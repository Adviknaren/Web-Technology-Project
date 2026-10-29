require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// Separate MongoDB collections keep each business entity independently queryable.
const productSchema = new mongoose.Schema({ sku: { type: String, required: true, unique: true }, name: String, cat: String, qty: Number, price: Number, sup: Number, loc: String, min: Number, re: Number, exp: String, daily: Number }, { timestamps: true, strict: false });
const supplierSchema = new mongoose.Schema({ id: { type: Number, required: true, unique: true }, name: String, lead: Number, phone: String, ontime: Number }, { timestamps: true, strict: false, id: false });
const movementSchema = new mongoose.Schema({ date: String, sku: String, delta: Number, type: String, reason: String }, { timestamps: true, strict: false });
const purchaseOrderSchema = new mongoose.Schema({ id: { type: String, required: true, unique: true }, sup: Number, date: String, status: String, applied: Boolean, items: [mongoose.Schema.Types.Mixed] }, { timestamps: true, strict: false, id: false });
const settingsSchema = new mongoose.Schema({ key: { type: String, unique: true, default: 'main' }, biz: String, cur: String, theme: String, low: Number }, { timestamps: true, strict: false });
const legacySchema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, state: mongoose.Schema.Types.Mixed, updatedAt: Date }, { versionKey: false });
const Product = mongoose.model('Product', productSchema);
const Supplier = mongoose.model('Supplier', supplierSchema);
const StockMovement = mongoose.model('StockMovement', movementSchema);
const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);
const AppSetting = mongoose.model('AppSetting', settingsSchema);
const AppState = mongoose.model('AppState', legacySchema);

app.get('/api/health', (req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

async function getState() {
  const [products, suppliers, moves, pos, setting] = await Promise.all([
    Product.find().select('-__v -createdAt -updatedAt').lean(),
    Supplier.find().select('-__v -createdAt -updatedAt').sort({ id: 1 }).lean(),
    StockMovement.find().select('-__v -createdAt -updatedAt').sort({ _id: 1 }).lean(),
    PurchaseOrder.find().select('-__v -createdAt -updatedAt').sort({ _id: 1 }).lean(),
    AppSetting.findOne({ key: 'main' }).select('-__v -createdAt -updatedAt').lean()
  ]);
  if (products.length || suppliers.length || moves.length || pos.length || setting) {
    return { products: products.map(({_id, ...x}) => x), suppliers: suppliers.map(({_id, ...x}) => x), moves: moves.map(({_id, ...x}) => x), pos: pos.map(({_id, ...x}) => x), set: setting ? { biz: setting.biz, cur: setting.cur, theme: setting.theme, low: setting.low } : { biz: 'StockSense Demo Store', cur: '₹', theme: 'light', low: 10 } };
  }
  // Backward compatibility: migrate the previous single-document app state on first read.
  const old = await AppState.findOne({ key: 'stocksense-main' }).lean();
  if (old && old.state) {
    await saveState(old.state);
    return old.state;
  }
  return null;
}

async function saveState(state) {
  const ops = (Model, arr, key) => arr.map(item => ({ updateOne: { filter: { [key]: item[key] }, update: { $set: item }, upsert: true } }));
  // Replace each collection's current snapshot so deletes in the UI are reflected in Atlas.
  const collections = [
    { Model: Product, items: state.products, key: 'sku' },
    { Model: Supplier, items: state.suppliers, key: 'id' },
    { Model: PurchaseOrder, items: state.pos, key: 'id' }
  ];
  for (const { Model, items, key } of collections) {
    const valid = Array.isArray(items) ? items : [];
    if (valid.length) await Model.bulkWrite(ops(Model, valid, key), { ordered: false });
    const keep = valid.map(x => x[key]);
    await Model.deleteMany(keep.length ? { [key]: { $nin: keep } } : {});
  }
  // Movement entries have no stable frontend ID; rebuild this collection from the complete state.
  await StockMovement.deleteMany({});
  if (state.moves.length) await StockMovement.insertMany(state.moves);
  await AppSetting.findOneAndUpdate({ key: 'main' }, { $set: { key: 'main', ...(state.set || {}) } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  // Retain a compatibility snapshot for older versions of the frontend/API.
  await AppState.findOneAndUpdate({ key: 'stocksense-main' }, { $set: { state, updatedAt: new Date() } }, { upsert: true });
}

app.get('/api/state', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database is not connected.' });
    const state = await getState();
    res.json({ state, updatedAt: new Date() });
  } catch (err) { console.error('Read state error:', err); res.status(500).json({ error: 'Could not load application data.' }); }
});

app.put('/api/state', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database is not connected.' });
    const state = req.body;
    if (!state || !Array.isArray(state.products) || !Array.isArray(state.suppliers) || !Array.isArray(state.moves) || !Array.isArray(state.pos) || !state.set) return res.status(400).json({ error: 'Invalid StockSense application state.' });
    await saveState(state);
    res.json({ ok: true, updatedAt: new Date(), collections: ['products', 'suppliers', 'stockmovements', 'purchaseorders', 'appsettings'] });
  } catch (err) { console.error('Save state error:', err); res.status(500).json({ error: 'Could not save application data.' }); }
});

app.get('*', (req, res, next) => { if (req.path.startsWith('/api/')) return next(); res.sendFile(path.join(__dirname, 'index.html')); });

async function start() {
  if (!MONGODB_URI) { console.error('Missing MONGODB_URI. Copy .env.example to .env and add your MongoDB Atlas connection string.'); process.exit(1); }
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('MongoDB Atlas connected');
    console.log('Collections ready: products, suppliers, stockmovements, purchaseorders, appsettings (plus appstates for backward compatibility)');
    app.listen(PORT, '0.0.0.0', () => console.log(`StockSense AI running at http://localhost:${PORT}`));
  } catch (err) { console.error('MongoDB connection failed:', err.message); console.error('Check Atlas Network Access and MONGODB_URI.'); process.exit(1); }
}
start();
