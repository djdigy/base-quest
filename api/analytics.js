// GET /api/analytics
// Reads analytics:events from Redis and returns aggregated metrics
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const raw = await redis.lrange('analytics:events', 0, 4999)

  let users = 0, gm = 0, shares = 0, returns = 0

  for (const item of raw) {
    const e = typeof item === 'string' ? JSON.parse(item) : item
    if (e.type === 'page:dashboard') users++
    else if (e.type === 'action:gm_click') gm++
    else if (e.type === 'action:share_click') shares++
    else if (e.type === 'return:next_day') returns++
  }

  const retentionRate = users > 0 ? Math.round((returns / users) * 100) : 0

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ users, gm, shares, returns, retentionRate })
}
