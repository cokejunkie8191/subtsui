// tests/unit/image.test.ts
import { describe, test, expect } from 'bun:test'
import { detectProtocol, renderBlocks } from '../../src/services/image'

describe('detectProtocol', () => {
  test('TERM_PROGRAM=WezTerm → kitty', () => {
    const orig = process.env.TERM_PROGRAM
    process.env.TERM_PROGRAM = 'WezTerm'
    expect(detectProtocol()).toBe('kitty')
    process.env.TERM_PROGRAM = orig
  })

  test('TERM_PROGRAM=iTerm.app → iterm2', () => {
    const orig = process.env.TERM_PROGRAM
    process.env.TERM_PROGRAM = 'iTerm.app'
    expect(detectProtocol()).toBe('iterm2')
    process.env.TERM_PROGRAM = orig
  })

  test('未知のターミナル → blocks', () => {
    const origProg = process.env.TERM_PROGRAM
    const origTerm = process.env.TERM
    process.env.TERM_PROGRAM = 'unknown'
    process.env.TERM = 'xterm'
    expect(detectProtocol()).toBe('blocks')
    process.env.TERM_PROGRAM = origProg
    process.env.TERM = origTerm
  })
})

describe('renderBlocks', () => {
  test('2x2 ピクセルの RGBA バッファからブロック文字を生成する', () => {
    // 4ピクセル: 白・黒・白・黒（RGBA各4バイト）
    const pixels = Buffer.from([
      255, 255, 255, 255,  // 白
      0, 0, 0, 255,        // 黒
      255, 255, 255, 255,  // 白
      0, 0, 0, 255,        // 黒
    ])
    const result = renderBlocks(pixels, 2, 2)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
