// GET /api/suggest-follows?fid=<viewer_fid>
// Verified GM'ciler once, sonra normal GM'ciler -- toplam 3 kisi
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const viewerFid = req.query.fid ? Number(req.query.fid) : null

  const [allFids, verifiedFids] = await Promise.all([
    redis.smembers('gm:fids'),
    redis.smembers('gm:verified'),
  ])

  const verifiedSet = new Set(verifiedFids.map(Number))
  const shuffle = arr => arr.sort(() => Math.random() - 0.5)

  const verified = shuffle(verifiedFids.map(Number).filter(f => f !== viewerFid))
  const others = shuffle(allFids.map(Number).filter(f => f !== viewerFid && !verifiedSet.has(f)))

  let candidates = [...verified, ...others].slice(0, 3)

  if (candidates.length < 3 && viewerFid !== 1351334) {
    if (!candidates.includes(1351334)) candidates.push(1351334)
  }

  if (candidates.length === 0) return res.status(200).json({ users: [], canGM: true })

  const apiKey = process.env.NEYNAR_API_KEY
  if (!apiKey) return res.status(200).json({ users: candidates.map(fid => ({ fid })), canGM: false })

  const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${candidates.join(',')}&viewer_fid=${viewerFid ?? 1}`
  const neynarRes = await fetch(url, {
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
  })

  if (!neynarRes.ok) return res.status(200).json({ users: candidates.map(fid => ({ fid })), canGM: false })

  const data = await neynarRes.json()
  const users = data.users ?? []

  const usersWithFollow = users.map(u => ({
    ...u,
    isFollowed: u.viewer_context?.following ?? false,
  }))

  const followedCount = usersWithFollow.filter(u => u.isFollowed).length
  const canGM = followedCount >= Math.min(3, candidates.length)

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    users: usersWithFollow,
    followedCount,
    canGM,
    total: candidates.length,
  })
}
