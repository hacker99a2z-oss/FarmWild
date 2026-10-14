# Farm City — Frontend (Telegram Mini App)

This directory contains the complete client frontend for Farm City, ready for deployment to **Vercel**.

## Features
- Telegram Mini App client (auto-expands and links user via `window.Telegram.WebApp`)
- Interactive farming game UI: seed inventory, animated crops with 10 growth stages, harvest sway animations, daily streak rewards
- Adsgram rewarded ad player with server-side backend verification
- TON Connect / Tonkeeper wallet integration for buying seeds and cash-out withdrawals
- Responsive mobile layout styled with Tailwind CSS

## Deployment to Vercel

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Select your repository.
4. Under **Root Directory**, click "Edit" and choose:
   ```
   frontend
   ```
5. Framework Preset: **Vite**
6. Under **Environment Variables**, set:
   ```env
   VITE_BACKEND_URL=https://your-backend.onrender.com
   ```
   *(Set this to your deployed Render backend service URL)*
7. Click **Deploy**!

## Local Development
```bash
npm install
npm run dev
```
By default, the Vite dev server will proxy `/api` and `/reward` requests to `http://localhost:5000` (or the URL in `VITE_BACKEND_URL`).
