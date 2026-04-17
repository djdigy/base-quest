// POST /api/track
// Body: { type, fid, address }
// Writes to analytics:events log AND increments lightweight counters
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

// Map event types → counter keys (null = no counter for this type)
const COUNTERS = {
  'page:dashboard':     'analytics:users',
  'action:gm_click':   'analytics:gm',
  'action:share_click':'analytics:shares',
  'return:next_day':   'analytics:returns',
}

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

  const todayUTC = new Date().toISOString().slice(0, 10)

  // Retention check on dashboard visits
  if (type === 'page:dashboard' && (fid || address)) {
    const key = fid ? `user:fid:${fid}.lastVisit` : `user:${address}.lastVisit`
    const lastVisit = await redis.get(key)

    if (lastVisit && lastVisit !== todayUTC) {
      const diffDays = Math.round((new Date(todayUTC) - new Date(lastVisit)) / 86400000)
      if (diffDays === 1) {
        // Fire return:next_day — increments its own counter recursively via pushEvent + incr
        await Promise.all([
          pushEvent('return:next_day', fid, address),
          redis.incr('analytics:returns'),
        ])
      }
    }

    if (lastVisit !== todayUTC) {
      await redis.set(key, todayUTC)
      if (fid && address) await redis.set(`user:${address}.lastVisit`, todayUTC)
    }
  }

  // Increment counter (if this type has one) + append to event log — in parallel
  const counterKey = COUNTERS[type]
  await Promise.all([
    pushEvent(type, fid, address),
    counterKey ? redis.incr(counterKey) : Promise.resolve(),
  ])

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true })
}
