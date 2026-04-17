// POST /api/track
// Body: { type, fid, address }
// Stores event in Redis list: analytics:events (capped at 5000)
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

const ALLOWED_TYPES = new Set([
  'page:dashboard',
  'page:gm',
  'page:referral',
  'action:gm_click',
  'action:share_click',
  'action:referral_copy',
])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, fid, address } = req.body ?? {}

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid type' })
  }

  const event = JSON.stringify({
    type,
    fid: fid || null,
    address: address || null,
    time: new Date().toISOString(),
  })

  // lpush + ltrim keeps list bounded at 5000 most-recent events
  await redis.lpush('analytics:events', event)
  await redis.ltrim('analytics:events', 0, 4999)

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true })
}
