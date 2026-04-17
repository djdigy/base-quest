// POST /api/record-gm?fid=<fid>
import { redis } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fid } = req.query
  if (!fid || !/^\d+$/.test(fid)) {
    return res.status(400).json({ error: 'Valid numeric fid is required' })
  }

  const fidNum = Number(fid)
  const now = Date.now()
  const todayUTC = new Date().toISOString().slice(0, 10)
  const gmKey = `gm:${fidNum}`

  const gmData = await redis.hgetall(gmKey)
  if (gmData?.lastDate === todayUTC) {
    const total = await redis.scard('gm:all')
    const verified = await redis.sismember('gm:verified', fidNum)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      ok: true,
      total,
      verified: !!verified,
      streak: Number(gmData.streak || 1),
      alreadyGMedToday: true,
    })
  }

  const isReturning = await redis.sismember('gm:all', fidNum)
  await redis.sadd('gm:all', fidNum)

  let verified = false
  if (isReturning) {
    await redis.sadd('gm:verified', fidNum)
    verified = true
  }

  let streak = 1
  if (gmData?.lastActive) {
    const hoursSinceLast = (now - Number(gmData.lastActive)) / (1000 * 60 * 60)
    const cur = Number(gmData.streak || 0)
    streak = hoursSinceLast <= 48 ? cur + 1 : 1
  }

  await Promise.all([
    redis.hset(gmKey, { streak, lastActive: now, lastDate: todayUTC }),
  ])

  const total = await redis.scard('gm:all')

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    ok: true,
    total,
    verified,
    streak,
    alreadyGMedToday: false,
  })
}
