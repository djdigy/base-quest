// GET /api/stats?fid=<fid>&address=<address>
// Base TX sayisi, Farcaster takipci, GM streak
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
})

async function getBaseTxCount(address) {
  if (!address) return null
  const apiKey = process.env.BASESCAN_API_KEY || ''
  const url = `https://api.basescan.org/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== '1') return 0
  return data.result.length
}

async function getFarcasterStats(fid, apiKey) {
  if (!fid || !apiKey) return null
  const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`
  const res = await fetch(url, { headers: { 'x-api-key': apiKey } })
  if (!res.ok) return null
  const data = await res.json()
  const user = data.users?.[0]
  return user ? { followers: user.follower_count, username: user.username } : null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { fid, address } = req.query
  if (!fid && !address) return res.status(400).json({ error: 'fid or address required' })

  const fidNum = fid ? Number(fid) : null

  const [txCount, fcStats, streak, lastGmDate, verified] = await Promise.all([
    getBaseTxCount(address),
    getFarcasterStats(fidNum, process.env.NEYNAR_API_KEY),
    fidNum ? redis.get(`streak:${fidNum}`).then(v => Number(v || 0)) : Promise.resolve(0),
    fidNum ? redis.get(`gm:lastdate:${fidNum}`) : Promise.resolve(null),
    fidNum ? redis.sismember('gm:verified', fidNum) : Promise.resolve(false),
  ])

  const todayUTC = new Date().toISOString().slice(0, 10)
  const gmmedToday = lastGmDate === todayUTC

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    baseTx: txCount,
    farcaster: fcStats,
    streak,
    gmmedToday,
    verified: !!verified,
    goals: { baseTx: 1000, followers: 1000 }
  })
}
