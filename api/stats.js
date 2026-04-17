// GET /api/stats?fid=<fid>&address=<address>
import { redis } from './_lib.js'

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

  const gmDataPromise = fidNum
    ? redis.hgetall(`gm:${fidNum}`)
    : Promise.resolve(null)

  const [txCount, fcStats, gmData, verified] = await Promise.all([
    getBaseTxCount(address),
    getFarcasterStats(fidNum, process.env.NEYNAR_API_KEY),
    gmDataPromise,
    fidNum ? redis.sismember('gm:verified', fidNum) : Promise.resolve(false),
  ])

  const todayUTC = new Date().toISOString().slice(0, 10)
  const streak = Number(gmData?.streak || 0)
  const gmmedToday = gmData?.lastDate === todayUTC

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
