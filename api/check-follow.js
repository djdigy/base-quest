// Vercel serverless function
// GET /api/check-follow?fid=<viewer_fid>&targetFid=<target_fid>
// Returns { isFollowing: boolean }
//
// Required env var: NEYNAR_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { fid, targetFid } = req.query

  if (!fid || !targetFid) {
    return res.status(400).json({ error: 'fid and targetFid query params are required' })
  }

  const apiKey = process.env.NEYNAR_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'NEYNAR_API_KEY is not configured' })
  }

  // Neynar: fetch targetFid's profile as seen by fid (viewer).
  // viewer_context.following === true means fid follows targetFid.
  const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${targetFid}&viewer_fid=${fid}`

  const neynarRes = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!neynarRes.ok) {
    const body = await neynarRes.text()
    return res.status(502).json({ error: `Neynar API error ${neynarRes.status}`, detail: body })
  }

  const data = await neynarRes.json()
  const isFollowing = data.users?.[0]?.viewer_context?.following ?? false

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ isFollowing })
}
