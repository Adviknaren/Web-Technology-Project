# StockSense AI — MongoDB Atlas

StockSense AI inventory dashboard with the original frontend and MongoDB Atlas persistence.

## Setup

1. Install Node.js (LTS recommended).
2. In this folder, copy `.env.example` to `.env`.
3. Edit `.env` and set `MONGODB_URI` to the connection string copied from MongoDB Atlas → Connect → Drivers. Replace the password placeholder; URL-encode special characters in the password.
4. In Atlas, make sure the database user exists and your current IP address is allowed under Network Access.
5. Run `npm install`, then `npm start`.
6. Open http://localhost:5000. Use the existing demo login.

## MongoDB collections

The backend stores the dashboard's data in separate collections while keeping the existing frontend and `/api/state` API unchanged:

- `products` — inventory products (unique SKU)
- `suppliers` — supplier records
- `stockmovements` — stock in/out, sales, returns, and adjustments
- `purchaseorders` — purchase orders and line items
- `appsettings` — store settings such as business name, currency, theme, and low-stock threshold
- `appstates` — compatibility snapshot for older versions of the API

On first access, if an older `appstates` record exists but the new collections are empty, the server migrates that saved state into the separate collections. Data is written to Atlas when the frontend saves changes. MongoDB collections generally appear in Atlas after their first document is inserted; start the app and save data once if they are not visible yet.

## Security

Never commit `.env` or share the real MongoDB password. The demo login is not production-grade authentication. Do not expose your Atlas database to all IP addresses permanently.
