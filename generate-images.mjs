import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'

const svg = (size) => Buffer.from(`
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#g)"/>
  <text
    x="50%" y="54%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Arial Black, Arial, sans-serif"
    font-weight="900"
    font-size="${size * 0.52}"
    fill="white"
    opacity="0.95"
  >B</text>
</svg>`)

mkdirSync('public', { recursive: true })

for (const [file, size] of [['icon.png', 512], ['og.png', 512], ['splash.png', 512]]) {
  await sharp(svg(size)).png().toFile(`public/${file}`)
  console.log(`✓ public/${file}`)
}
