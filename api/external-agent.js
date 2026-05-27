/**
 * api/external-agent.js
 *
 * Proxies requests from the Trading Hub UI to your VPS trading agent.
 *
 * Required Vercel environment variables:
 *   TRADING_AGENT_URL     — e.g. http://153.92.209.74:8000
 *   TRADING_AGENT_API_KEY — the key you generated on the VPS
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const agentUrl = process.env.TRADING_AGENT_URL
  const apiKey   = process.env.TRADING_AGENT_API_KEY

  if (!agentUrl) return res.status(500).json({ error: 'TRADING_AGENT_URL not set in Vercel environment variables' })
  if (!apiKey)   return res.status(500).json({ error: 'TRADING_AGENT_API_KEY not set in Vercel environment variables' })

  const { instruction, message, history, dryRun } = req.body
  const userMessage = message || instruction || 'Run your full trading session: scan the watchlist, review all positions, and execute trades where signals are strong.'

  try {
    const response = await fetch(`${agentUrl}/agent/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ message: userMessage }),
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) : {}

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.detail ?? data?.error ?? `Agent returned ${response.status}`,
      })
    }

    // Normalise VPS response shape → shape the frontend expects
    // VPS returns: { response, actions, iterations }
    // Frontend expects: { reply, trades, agentLog, iterations, updatedHistory }
    const trades = (data.actions ?? [])
      .filter(a => a.tool === 'place_market_order' || a.tool === 'place_limit_order')
      .map(a => ({
        tool: a.tool,
        input: {
          ticker:   a.inputs?.ticker,
          quantity: a.inputs?.quantity,
          reason:   a.tool === 'place_limit_order' ? `limit @ ${a.inputs?.limit_price}` : 'market order',
        },
      }))

    const agentLog = (data.actions ?? []).map(a => ({
      type:  'call',
      tool:  a.tool,
      input: a.inputs,
    }))

    return res.status(200).json({
      reply:          data.response ?? '',
      trades,
      agentLog,
      iterations:     data.iterations ?? 1,
      updatedHistory: history ?? [],
    })

  } catch (err) {
    console.error('[external-agent error]', err)
    return res.status(502).json({ error: `Could not reach external agent: ${err.message}` })
  }
}
