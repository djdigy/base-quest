// POST /api/migrate
// One-shot migration: scalar keys → gm:{fid} hashes, gm:fids → gm:all
// Idempotent — safe to run multiple times.
import { redis } from './_lib.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const secret = process.env.MIGRATE_SECRET
  if (secret && req.headers['x-migrate-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 1. Collect all known FIDs from the old set (gm:fids) and new set (gm:all)
  const [oldFids, newFids] = await Promise.all([
    redis.smembers('gm:fids'),
    redis.smembers('gm:all'),
  ])
  const allFids = [...new Set([...oldFids, ...newFids].map(Number))]

  let migrated = 0
  let skipped = 0

  for (const fid of allFids) {
    const gmKey = `gm:${fid}`
    const existing = await redis.hgetall(gmKey)

    // Read old scalar keys
    const [oldStreak, oldLastDate, oldLastTs] = await Promise.all([
      redis.get(`streak:${fid}`),
      redis.get(`gm:lastdate:${fid}`),
      redis.get(`gm:lastts:${fid}`),
    ])

    const hasOldData = oldStreak !== null || oldLastDate !== null || oldLastTs !== null

    if (!hasOldData && existing) {
      skipped++
      continue
    }

    // Merge: prefer existing hash values, fall back to old scalar values
    const streak = existing?.streak ?? oldStreak ?? 0
    const lastDate = existing?.lastDate ?? oldLastDate ?? null
    const lastActive = existing?.lastActive ?? oldLastTs ?? null

    await redis.hset(gmKey, {
      streak: Number(streak),
      ...(lastDate && { lastDate }),
      ...(lastActive && { lastActive: Number(lastActive) }),
    })

    // Delete old scalar keys
    const toDelete = [`streak:${fid}`, `gm:lastdate:${fid}`, `gm:lastts:${fid}`].filter(
      (_, i) => [oldStreak, oldLastDate, oldLastTs][i] !== null
    )
    if (toDelete.length) await redis.del(...toDelete)

    // Add to new set
    await redis.sadd('gm:all', fid)

    migrated++
  }

  // 2. Rename gm:fids → gm:all if old set still exists and new is populated
  const oldSetSize = await redis.scard('gm:fids')
  if (oldSetSize > 0) {
    await redis.del('gm:fids')
  }

  return res.status(200).json({
    ok: true,
    totalFids: allFids.length,
    migrated,
    skipped,
    oldSetDeleted: oldSetSize > 0,
  })
}
