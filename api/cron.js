/**
 * api/cron.js
 * Vercel cron job — triggers your VPS agent every 15 minutes during market hours.
 *
 * Schedule is set in vercel.json:
 *   "crons": [{ "path": "/api/cron", "schedule": "0,15,30,45 14-20 * * 1-5" }]
 */

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorised' })
    }
  }

  // Only run during US market hours (14:30–21:00 UTC, Mon–Fri)
  const now     = new Date()
  const day     = now.getUTCDay()
  const hour    = now.getUTCHours()
  const minute  = now.getUTCMinutes()
  const timeUTC = hour * 60 + minute

  if (day === 0 || day === 6) {
    return res.status(200).json({ skipped: true, reason: 'Weekend — markets closed' })
  }
  if (timeUTC < 14 * 60 + 30 || timeUTC >= 21 * 60) {
    return res.status(200).json({ skipped: true, reason: `Outside market hours (UTC: ${hour}:${String(minute).padStart(2,'0')})` })
  }

  const agentUrl = process.env.TRADING_AGENT_URL
  const apiKey   = process.env.TRADING_AGENT_API_KEY

  if (!agentUrl || !apiKey) {
    return res.status(500).json({ error: 'TRADING_AGENT_URL or TRADING_AGENT_API_KEY not set' })
  }

  try {
    const response = await fetch(`${agentUrl}/agent/analyse`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
    })

    const data = await response.json()

    return res.status(200).json({
      ok:         true,
      iterations: data.iterations,
      summary:    (data.response ?? '').slice(0, 500),
    })
  } catch (err) {
    console.error('[cron error]', err)
    return res.status(500).json({ error: err.message })
  }
}
