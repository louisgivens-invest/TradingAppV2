/**
 * api/t212.js
 * Vercel serverless function — proxies all Trading 212 API calls.
 * Your API keys never leave the server.
 *
 * Usage from frontend:
 *   fetch('/api/t212', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ path: '/equity/positions', method: 'GET' })
 *   })
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey    = process.env.T212_API_KEY
  const apiSecret = process.env.T212_API_SECRET
  const useLive   = process.env.T212_LIVE === 'true'

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: 'T212 API credentials not configured. Add T212_API_KEY and T212_API_SECRET to your Vercel environment variables.',
    })
  }

  const { path, method = 'GET', body: requestBody } = req.body

  if (!path) {
    return res.status(400).json({ error: 'Missing required field: path' })
  }

  // Whitelist allowed paths to prevent SSRF
  const allowedPrefixes = [
    '/equity/account',
    '/equity/positions',
    '/equity/orders',
    '/equity/history',
    '/equity/metadata',
    '/equity/pies',
  ]
  const isAllowed = allowedPrefixes.some(prefix => path.startsWith(prefix))
  if (!isAllowed) {
    return res.status(403).json({ error: `Path not allowed: ${path}` })
  }

  const base = useLive
    ? 'https://live.trading212.com/api/v0'
    : 'https://demo.trading212.com/api/v0'

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')

  try {
    const fetchOptions = {
      method,
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    }

    if (method !== 'GET' && method !== 'DELETE' && requestBody) {
      fetchOptions.body = JSON.stringify(requestBody)
    }

    const upstream = await fetch(`${base}${path}`, fetchOptions)

    // Forward rate limit headers so the frontend can track them
    const rlHeaders = [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'x-ratelimit-used',
      'x-ratelimit-period',
    ]
    rlHeaders.forEach(h => {
      const val = upstream.headers.get(h)
      if (val) res.setHeader(h, val)
    })

    // Handle empty responses (e.g. DELETE 200 with no body)
    const text = await upstream.text()
    const data = text ? JSON.parse(text) : {}

    return res.status(upstream.status).json(data)
  } catch (err) {
    console.error('[t212 proxy error]', err)
    return res.status(502).json({ error: `Upstream error: ${err.message}` })
  }
}
