# PDT-1 — Personal Day Trader Agent Hub

A self-hosted trading agent dashboard that connects to your Trading 212 account and uses Claude AI to analyse and execute trades.

---

## What's included

| File | Purpose |
|------|---------|
| `src/App.jsx` | React frontend — dashboard, AI agent chat, transactions, strategies |
| `api/t212.js` | Vercel serverless proxy — all T212 API calls go through here (keys stay server-side) |
| `api/agent.js` | Vercel serverless function — runs the Claude AI agent with T212 tools |

---

## Quick start (local dev)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your keys:

```
T212_API_KEY=your_t212_api_key
T212_API_SECRET=your_t212_api_secret
T212_LIVE=false
ANTHROPIC_API_KEY=sk-ant-...
```

> ⚠️ Always start with `T212_LIVE=false` (Paper Trading) to test safely.

### 3. Run locally with Vercel CLI (required for the API routes)

```bash
npm install -g vercel
vercel dev
```

This runs both the Vite frontend and the serverless functions at `http://localhost:3000`.

> `npm run dev` alone won't work because the `/api/*` routes need the Vercel runtime.

---

## Deploy to Vercel

### Option A — GitHub (recommended, auto-deploys on push)

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/trading-agent-hub.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.

3. Vercel auto-detects Vite. Click **Deploy**.

4. After deploy, go to **Project → Settings → Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `T212_API_KEY` | Your Trading 212 API key |
   | `T212_API_SECRET` | Your Trading 212 API secret |
   | `T212_LIVE` | `false` (paper) or `true` (live) |
   | `ANTHROPIC_API_KEY` | Your Anthropic API key |

5. **Redeploy** after adding env vars (Settings → Deployments → Redeploy).

### Option B — Vercel CLI

```bash
vercel --prod
```

Then set env vars:
```bash
vercel env add T212_API_KEY
vercel env add T212_API_SECRET
vercel env add T212_LIVE
vercel env add ANTHROPIC_API_KEY
```

---

## Getting your API keys

### Trading 212
1. Open the T212 app (mobile or web)
2. Tap your account icon → **Settings** → **API**
3. Generate a new key pair
4. Optionally restrict to your Vercel server IP for security

### Anthropic
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → **Create Key**

---

## Using the AI Agent

1. Navigate to **AI Agent** in the sidebar
2. Keep **Dry Run ON** at first — the agent will explain what it *would* do without placing real orders
3. Type an instruction, e.g.:
   - `"Review my open positions and suggest stop-losses"`
   - `"Check if any positions are down more than 5% and sell them"`
   - `"Buy 2 shares of AAPL_US_EQ if I have enough cash"`
4. The agent uses Claude to reason, fetches live data from T212, and responds with its analysis
5. Once comfortable, toggle **Dry Run OFF** to allow real order placement

---

## Architecture

```
Browser (React)
    │
    ├─ GET /            → Vite static build
    ├─ POST /api/t212   → api/t212.js  → Trading 212 API
    └─ POST /api/agent  → api/agent.js → Anthropic API
                                              └─ tool calls → T212 API
```

Your API keys are **only ever used server-side** inside the Vercel functions. They are never sent to the browser.

---

## ⚠️ Important warnings

- **This is not financial advice.** Automated trading carries real risk of loss.
- Always test thoroughly on Paper Trading before enabling live mode.
- The Trading 212 API is in **beta** — order endpoints are not idempotent (duplicate requests may create duplicate orders).
- Only **Invest** and **Stocks ISA** account types are supported by the T212 API.
- The agent's risk controls (max £500/trade, £200/day loss limit) are enforced via the system prompt — they are a safety guideline, not a hard technical limit.

---

## License

MIT — use at your own risk.
