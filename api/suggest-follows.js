// GET /api/suggest-follows?fid=<viewer_fid>
// Returns up to 5 random BaseAmp users (excluding viewer) enriched via Neynar
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN, NEYNAR_API_KEY

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const viewerFid = req.query.fid ? Number(req.query.fid) : null

  // Fetch all FIDs that have sent GM
  const allFids = await redis.smembers('gm:fids')

  // Exclude the viewer and shuffle
  const candidates = allFids
    .map(Number)
    .filter(f => f !== viewerFid)
    .sort(() => Math.random() - 0.5)
    .slice(0, 5)

  if (candidates.length === 0) {
    return res.status(200).json({ users: [] })
  }

  // Enrich with Neynar profile data
  const apiKey = process.env.NEYNAR_API_KEY
  if (!apiKey) {
    return res.status(200).json({ users: candidates.map(fid => ({ fid })) })
  }

  const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${candidates.join(',')}&viewer_fid=${viewerFid ?? 1}`
  const neynarRes = await fetch(url, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
  })

  if (!neynarRes.ok) {
    return res.status(200).json({ users: candidates.map(fid => ({ fid })) })
  }

  const data = await neynarRes.json()

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ users: data.users ?? [] })
}
