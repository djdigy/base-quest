// POST /api/record-gm?fid=<fid>
// Records the FID that sent a GM into Upstash Redis set "gm:fids"
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
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

  await redis.sadd('gm:fids', Number(fid))
  const total = await redis.scard('gm:fids')

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true, total })
}
