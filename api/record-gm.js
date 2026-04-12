// POST /api/record-gm?fid=<fid>
// 1. GM: gm:fids setine ekle
// 2. GM: gm:verified setine ekle (follow verification)
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fid } = req.query
  if (!fid || !/^\d+$/.test(fid)) {
    return res.status(400).json({ error: 'Valid numeric fid is required' })
  }

  const fidNum = Number(fid)

  const isReturning = await redis.sismember('gm:fids', fidNum)

  await redis.sadd('gm:fids', fidNum)

  let verified = false
  if (isReturning) {
    await redis.sadd('gm:verified', fidNum)
    verified = true
  }

  const total = await redis.scard('gm:fids')

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true, total, verified })
}
