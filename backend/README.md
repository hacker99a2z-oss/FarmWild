# Farm City — Backend API & Telegram Bot

This directory contains the complete backend service for Farm City, ready for deployment to **Render**.

## Features
- **Server-Authoritative Game State**: Player balances, seed inventory, fields, and harvests are stored in MongoDB.
- **Telegram Verification**: Cryptographic HMAC-SHA256 verification of `initData` using your Telegram Bot Token.
- **Server-Side Ad Verification**: Handles `/reward` callbacks to verify cooldowns and increment plant progress.
- **TON Blockchain & Payments**:
  - Live TON/USD price quotes.
  - Automatically matches orders on the merchant TON address by payment comment.
  - Automatic batch payouts to player Tonkeeper wallets from server-held payout wallet.
- **Telegram Bot Webhook**: Handles `/start` command with intro video, game launch buttons, and referral tracking.

## Deployment to Render

### Option A: Using Blueprints (`render.yaml`)
1. Go to [dashboard.render.com](https://dashboard.render.com) and click **Blueprints** -> **New Blueprint Instance**.
2. Connect your GitHub repository.
3. Render will detect `render.yaml` inside `backend/` and set up the Web Service automatically.

### Option B: Manual Web Service Setup
1. Click **New +** -> **Web Service**.
2. Connect your repository.
3. Configure the service settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Under **Environment Variables**, add:
   - `MONGODB_URI`: Your MongoDB connection string (e.g. MongoDB Atlas)
   - `MONGODB_DB`: `farmcity`
   - `TELEGRAM_BOT_TOKEN`: Your Telegram Bot Token from @BotFather
   - `TELEGRAM_WEBHOOK_SECRET`: (Optional) Secret for Telegram webhook verification
   - `WEBAPP_URL`: Your deployed frontend URL on Vercel (e.g. `https://your-app.vercel.app`)
   - `TON_WALLET_MNEMONIC`: 24-word seed phrase of your payout bot wallet
   - `TON_WALLET_VERSION`: `v5r1` (or `v4`)
   - `TONCENTER_API_KEY`: (Optional) API key for Toncenter
   - `PAYOUT_CRON_SECRET`: Secret key for external ping cron (`/api/public/payout?key=...`)
5. Click **Create Web Service**!

## Endpoints
- `POST /api/player/load`: Verify login & return player farm view
- `POST /api/player/tap`: Plant seeds or harvest mature crops
- `POST /api/player/claim-daily`: Claim weekly daily reward streak
- `POST /api/player/sell`: Sell crops for USD balance
- `POST /api/player/withdraw`: Queue TON wallet payout
- `GET /api/ton/quote`: Get current TON price and conversion rate
- `POST /api/orders/create`: Create TON seed purchase order
- `POST /api/orders/confirm`: Verify payment on the blockchain
- `GET /reward`: Server-side rewarded ad verification callback
- `POST /api/public/telegram`: Telegram bot webhook
- `GET /api/public/payout`: Process payout queue (triggered by cron)
- `GET /health`: Health check endpoint
