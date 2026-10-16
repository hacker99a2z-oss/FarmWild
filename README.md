# Farm City — Telegram Mini App (Full-Stack Architecture)

Farm City is a Telegram Mini App farm simulator game with real TON blockchain integration and auto-payouts.

The repository is divided into two separate, independently deployable parts:

```
├── frontend/    # Telegram Mini App client (Vite + React SPA for Vercel)
├── backend/     # Express API server + Telegram Bot + Auto-payouts (Node.js for Render)
├── server.ts    # Unified dev server running both on port 3000
└── package.json # Root orchestrator
```

---

## 1. Frontend (`frontend/`) — Deploy on Vercel

The frontend is a lightweight client-side SPA designed for Telegram WebApp and standard browsers.

### Deploying to Vercel:
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Framework Preset** to `Vite`.
4. In **Environment Variables**, add:
   ```env
   VITE_BACKEND_URL=https://your-backend.onrender.com
   ```
5. Click **Deploy**.

---

## 2. Backend (`backend/`) — Deploy on Render

The backend is an Express Node.js server handling MongoDB persistence, cryptographic Telegram `initData` verification, server-side rewarded ad verification, and TON wallet batch payouts.

### Deploying to Render:
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Create a new **Web Service** or use the included `render.yaml` Blueprint.
3. If setting up manually:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add the following **Environment Variables**:
   - `MONGODB_URI`: MongoDB connection string (e.g. MongoDB Atlas)
   - `MONGODB_DB`: `farmcity`
   - `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
   - `TELEGRAM_WEBHOOK_SECRET`: Optional secret for bot webhook
   - `WEBAPP_URL`: Your deployed frontend URL on Vercel
   - `TON_WALLET_MNEMONIC`: 24-word seed phrase of your payout bot wallet
   - `TON_WALLET_VERSION`: `v5r1` (or `v4`)
   - `TONCENTER_API_KEY`: Toncenter / TonAPI key
   - `PAYOUT_CRON_SECRET`: Secret token for cron triggers (`/api/public/payout?key=...`)

---

## 3. Local Development

Run the entire full-stack app on `http://localhost:3000`:
```bash
npm install
npm run dev
```
Both the backend API and frontend Vite dev middleware run unified on port 3000.
