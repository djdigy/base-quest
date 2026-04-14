// GET /api/transcript?videoId=<videoId>
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { videoId } = req.query
  if (!videoId) return res.status(400).json({ error: 'videoId required' })
  try {
    const transcriptUrl = `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`
    const ytRes = await fetch(transcriptUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    })
    if (!ytRes.ok) return res.status(400).json({ error: 'Transcript alinamadi', status: ytRes.status })
    const data = await ytRes.json()
    const text = data.events?.filter(e => e.segs).map(e => e.segs.map(s => s.utf8).join('')).join(' ').replace(/\s+/g, ' ').trim()
    if (!text || text.length < 100) return res.status(400).json({ error: 'Transcript bulunamadi' })
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: `Kripto analist olarak bu YouTube transkriptini Turkce ve Ingilizce ozetle:\n\n${text.slice(0, 8000)}` }] })
    })
    const claudeData = await claudeRes.json()
    const summary = claudeData.content?.[0]?.text || 'Ozet olusturulamadi'
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ videoId, transcriptLength: text.length, summary })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}