// tests/unit/image.test.ts
import { describe, test, expect } from 'bun:test'
import { detectProtocol, renderBlocks } from '../../src/services/image'

describe('detectProtocol', () => {
  test('デフォルトは blocks（Ink との互換性のため）', () => {
    const orig = process.env.SUBTSUI_IMAGE_PROTOCOL
    delete process.env.SUBTSUI_IMAGE_PROTOCOL
    expect(detectProtocol()).toBe('blocks')
    if (orig !== undefined) process.env.SUBTSUI_IMAGE_PROTOCOL = orig
  })

  test('SUBTSUI_IMAGE_PROTOCOL=kitty で上書き可能', () => {
    const orig = process.env.SUBTSUI_IMAGE_PROTOCOL
    process.env.SUBTSUI_IMAGE_PROTOCOL = 'kitty'
    expect(detectProtocol()).toBe('kitty')
    if (orig === undefined) delete process.env.SUBTSUI_IMAGE_PROTOCOL
    else process.env.SUBTSUI_IMAGE_PROTOCOL = orig
  })

  test('SUBTSUI_IMAGE_PROTOCOL=iterm2 で上書き可能', () => {
    const orig = process.env.SUBTSUI_IMAGE_PROTOCOL
    process.env.SUBTSUI_IMAGE_PROTOCOL = 'iterm2'
    expect(detectProtocol()).toBe('iterm2')
    if (orig === undefined) delete process.env.SUBTSUI_IMAGE_PROTOCOL
    else process.env.SUBTSUI_IMAGE_PROTOCOL = orig
  })

  test('不正な SUBTSUI_IMAGE_PROTOCOL 値は無視して blocks', () => {
    const orig = process.env.SUBTSUI_IMAGE_PROTOCOL
    process.env.SUBTSUI_IMAGE_PROTOCOL = 'invalid'
    expect(detectProtocol()).toBe('blocks')
    if (orig === undefined) delete process.env.SUBTSUI_IMAGE_PROTOCOL
    else process.env.SUBTSUI_IMAGE_PROTOCOL = orig
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
