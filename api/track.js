// POST /api/track
// Body: { type, fid, address }
// Stores event in Redis list: analytics:events (capped at 5000)
// For page:dashboard: checks last visit date and emits return:next_day if applicable
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
  'return:next_day',
])

async function pushEvent(type, fid, address) {
  const event = JSON.stringify({
    type,
    fid: fid || null,
    address: address || null,
    time: new Date().toISOString(),
  })
  await redis.lpush('analytics:events', event)
  await redis.ltrim('analytics:events', 0, 4999)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, fid, address } = req.body ?? {}

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({ error: 'Invalid type' })
  }

  const todayUTC = new Date().toISOString().slice(0, 10) // "2026-04-17"

  // Retention check on dashboard visits
  if (type === 'page:dashboard' && (fid || address)) {
    const key = fid ? `user:fid:${fid}.lastVisit` : `user:${address}.lastVisit`
    const lastVisit = await redis.get(key)

    if (lastVisit && lastVisit !== todayUTC) {
      // User visited on a different day — check if it was yesterday (next-day return)
      const last = new Date(lastVisit)
      const today = new Date(todayUTC)
      const diffDays = Math.round((today - last) / 86400000)
      if (diffDays === 1) {
        await pushEvent('return:next_day', fid, address)
      }
    }

    // Update last visit date (only write if changed to avoid unnecessary ops)
    if (lastVisit !== todayUTC) {
      await redis.set(key, todayUTC)
      // Also store by address if both are available
      if (fid && address) {
        await redis.set(`user:${address}.lastVisit`, todayUTC)
      }
    }
  }

  await pushEvent(type, fid, address)

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true })
}
