// POST /api/record-gm?fid=<fid>
// 1. GM: gm:fids setine ekle
// 2. GM: gm:verified setine ekle (2. GM = follow verification)
// 3. Streak hesapla: son GM 24-48 saat onceyse streak artar, 48+ saat gecmisse sifirlanir
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
  const now = Date.now()
  const todayUTC = new Date().toISOString().slice(0, 10) // "2026-04-13"

  // 1. Bugun zaten GM atildi mi?
  const lastGmDate = await redis.get(`gm:lastdate:${fidNum}`)
  if (lastGmDate === todayUTC) {
    // Bugun zaten atilmis, streak'i tekrar artirma
    const streak = await redis.get(`streak:${fidNum}`)
    const total = await redis.scard('gm:fids')
    const verified = await redis.sismember('gm:verified', fidNum)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({
      ok: true,
      total,
      verified: !!verified,
      streak: Number(streak || 1),
      alreadyGMedToday: true,
    })
  }

  // 2. gm:fids setine ekle
  const isReturning = await redis.sismember('gm:fids', fidNum)
  await redis.sadd('gm:fids', fidNum)

  // 3. Verified kontrolu (2. GM ve sonrasi)
  let verified = false
  if (isReturning) {
    await redis.sadd('gm:verified', fidNum)
    verified = true
  }

  // 4. Streak hesapla
  const lastGmTs = await redis.get(`gm:lastts:${fidNum}`)
  let streak = 1

  if (lastGmTs) {
    const hoursSinceLast = (now - Number(lastGmTs)) / (1000 * 60 * 60)
    const currentStreak = await redis.get(`streak:${fidNum}`)
    const cur = Number(currentStreak || 0)

    if (hoursSinceLast <= 48) {
      // 48 saat icinde GM atilmis -> streak devam
      streak = cur + 1
    } else {
      // 48 saatten fazla gecmis -> streak sifirla
      streak = 1
    }
  }

  // 5. Redis'e kaydet
  await Promise.all([
    redis.set(`streak:${fidNum}`, streak),
    redis.set(`gm:lastts:${fidNum}`, now),
    redis.set(`gm:lastdate:${fidNum}`, todayUTC),
  ])

  const total = await redis.scard('gm:fids')

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    ok: true,
    total,
    verified,
    streak,
    alreadyGMedToday: false,
  })
}
