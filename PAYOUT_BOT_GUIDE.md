# Auto payout + Bot /start guide

## 1. Render env variables (Dashboard -> your service -> Environment)
- TELEGRAM_WEBHOOK_SECRET = any random text (e.g. farm8x92kd)
- PAYOUT_CRON_SECRET     = another random text
- WEBAPP_URL             = https://himu-8rda.onrender.com
- CHANNEL_URL            = https://t.me/your_channel
- SUPPORT_URL            = https://t.me/your_support_group
- INTRO_VIDEO            = Telegram file_id OR a public .mp4 link (10-15s, under 20MB)
- TONCENTER_API_KEY      = free key from @tonapibot (toncenter) - strongly recommended
(keep existing MONGODB_URI, TELEGRAM_BOT_TOKEN, TON_WALLET_MNEMONIC, TON_WALLET_VERSION)

## 2. Connect bot webhook (open once in browser)
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://himu-8rda.onrender.com/api/public/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>

## 3. Free cron (cron-job.org) - every 5 minutes
https://himu-8rda.onrender.com/api/public/payout?key=<PAYOUT_CRON_SECRET>
Keeps Render free awake and processes the payout queue.

## 4. Payout wallet
Keep enough TON in the wallet of TON_WALLET_MNEMONIC. If low, withdrawals stay "pending" and are sent automatically after you top up.
