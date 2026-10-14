# Render Manual Setup Instructions

## Repository Structure
Your GitHub repository has the code inside `farm-fresh-upgrade-main` folder.

## Render Setup Steps

### 1. Delete render.yaml from GitHub
```bash
git rm render.yaml
git commit -m "Remove render.yaml - using manual config"
git push
```

### 2. Go to Render Dashboard
1. Delete existing "farm-city" service (if exists)
2. Click "New +" → "Web Service"

### 3. Connect Repository
1. Click "Connect GitHub"
2. Select "hacker99a2z-oss/himu"
3. Click "Connect"

### 4. Configure Service

**IMPORTANT**: In the "Root Directory" field, enter:
```
farm-fresh-upgrade-main
```

Other settings:
- **Name**: farm-city
- **Branch**: main
- **Runtime**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `node .output/server/index.mjs`

### 5. Environment Variables
Add these in "Advanced" section:
```
MONGODB_URI = your-mongodb-connection-string
MONGODB_DB = farmcity
TELEGRAM_BOT_TOKEN = your-bot-token
TON_WALLET_MNEMONIC = "word1 word2 ... word24"
TON_WALLET_VERSION = v5r1
TONCENTER_API_KEY = your-tonapi-key
```

### 6. Deploy
Click "Create Web Service"

## Withdrawal page links
In your existing Render service add `PAYMENTS_PROOF_URL` and `CONTACT_SUPPORT_URL` with your full HTTPS links, then redeploy. Missing or invalid links leave that button disabled. Existing settings are unchanged.
