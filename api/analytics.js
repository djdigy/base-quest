// GET /api/analytics
// Reads pre-incremented counters — O(1), no event scan
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const [users, gm, shares, returns] = await Promise.all([
    redis.get('analytics:users'),
    redis.get('analytics:gm'),
    redis.get('analytics:shares'),
    redis.get('analytics:returns'),
  ])

  const u = Number(users || 0)
  const r = Number(returns || 0)
  const retentionRate = u > 0 ? Math.round((r / u) * 100) : 0

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    users: u,
    gm: Number(gm || 0),
    shares: Number(shares || 0),
    returns: r,
    retentionRate,
  })
}
