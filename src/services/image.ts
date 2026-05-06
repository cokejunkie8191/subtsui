// src/services/image.ts
import { LRUCache } from 'lru-cache'
import { Jimp } from 'jimp'

export type ImageProtocol = 'kitty' | 'iterm2' | 'sixel' | 'blocks'

export function detectProtocol(): ImageProtocol {
  const term = process.env.TERM_PROGRAM ?? ''
  const termName = process.env.TERM ?? ''
  if (term === 'WezTerm') return 'kitty'
  if (term === 'iTerm.app') return 'iterm2'
  if (term === 'ghostty') return 'kitty'
  if (termName.includes('kitty')) return 'kitty'
  return 'blocks'
}

// RGBA ピクセルバッファから上下ハーフブロック文字列を生成
export function renderBlocks(pixels: Buffer, width: number, height: number): string {
  let out = ''
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x++) {
      const topIdx = (y * width + x) * 4
      const botIdx = ((y + 1) * width + x) * 4
      const tr = pixels[topIdx], tg = pixels[topIdx + 1], tb = pixels[topIdx + 2]
      const br = y + 1 < height ? pixels[botIdx] : 0
      const bg = y + 1 < height ? pixels[botIdx + 1] : 0
      const bb = y + 1 < height ? pixels[botIdx + 2] : 0
      out += `\x1b[38;2;${tr};${tg};${tb}m\x1b[48;2;${br};${bg};${bb}m▀`
    }
    out += '\x1b[0m\n'
  }
  return out
}

function renderKitty(imageData: Buffer, width: number, height: number): string {
  const b64 = imageData.toString('base64')
  const chunkSize = 4096
  let result = ''
  for (let i = 0; i < b64.length; i += chunkSize) {
    const chunk = b64.slice(i, i + chunkSize)
    const isFirst = i === 0
    const isLast = i + chunkSize >= b64.length
    const m = isLast ? 0 : 1
    if (isFirst) {
      result += `\x1b_Ga=T,f=32,s=${width},v=${height},m=${m};${chunk}\x1b\\`
    } else {
      result += `\x1b_Gm=${m};${chunk}\x1b\\`
    }
  }
  return result
}

function renderIterm2(imageData: Buffer): string {
  const b64 = imageData.toString('base64')
  return `\x1b]1337;File=inline=1:${b64}\x07`
}

const cache = new LRUCache<string, Buffer>({ max: 50 })

export async function fetchAndRender(
  coverArtUrl: string,
  pixelSize: number,
  protocol: ImageProtocol
): Promise<string> {
  const cacheKey = `${coverArtUrl}:${pixelSize}:${protocol}`
  const cached = cache.get(cacheKey)

  let imageBuffer: Buffer
  if (cached) {
    imageBuffer = cached
  } else {
    const res = await fetch(coverArtUrl)
    if (!res.ok) return ''
    const raw = Buffer.from(await res.arrayBuffer())
    const img = await Jimp.fromBuffer(raw)
    img.resize({ w: pixelSize, h: pixelSize })

    if (protocol === 'kitty') {
      // RGBA raw pixels for Kitty
      imageBuffer = img.bitmap.data as Buffer
    } else {
      // PNG for iTerm2
      imageBuffer = await img.getBuffer('image/png')
    }
    cache.set(cacheKey, imageBuffer)
  }

  if (protocol === 'kitty') {
    return renderKitty(imageBuffer, pixelSize, pixelSize)
  } else if (protocol === 'iterm2') {
    return renderIterm2(imageBuffer)
  } else {
    // blocks: re-fetch for RGBA
    const res = await fetch(coverArtUrl)
    const raw = Buffer.from(await res.arrayBuffer())
    const img = await Jimp.fromBuffer(raw)
    img.resize({ w: pixelSize, h: pixelSize * 2 }) // 2:1 aspect for half-block chars
    return renderBlocks(img.bitmap.data as Buffer, pixelSize, pixelSize * 2)
  }
}
