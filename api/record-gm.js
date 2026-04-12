// POST /api/record-gm?fid=<fid>
// Records the FID that sent a GM into Vercel KV set "gm:fids"
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fid } = req.query
  if (!fid || !/^\d+$/.test(fid)) {
    return res.status(400).json({ error: 'Valid numeric fid is required' })
  }

  await kv.sadd('gm:fids', Number(fid))
  const total = await kv.scard('gm:fids')

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true, total })
}
