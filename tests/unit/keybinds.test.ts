import { describe, test, expect } from 'bun:test'
import { keyMatches, normalizeKey } from '../../src/config/keybinds'

describe('normalizeKey', () => {
  test('"return" を "return" に正規化する', () => {
    expect(normalizeKey('return')).toBe('return')
  })
  test('"enter" を "return" に正規化する（エイリアス）', () => {
    expect(normalizeKey('enter')).toBe('return')
  })
  test('"S-tab" を "S-tab" のまま返す', () => {
    expect(normalizeKey('S-tab')).toBe('S-tab')
  })
})

describe('keyMatches', () => {
  test('設定されたキーリストにマッチする', () => {
    expect(keyMatches('j', ['j', 'up'])).toBe(true)
    expect(keyMatches('up', ['j', 'up'])).toBe(true)
  })
  test('マッチしないキーは false', () => {
    expect(keyMatches('k', ['j', 'up'])).toBe(false)
  })
  test('エイリアスを通じてマッチする', () => {
    expect(keyMatches('enter', ['return'])).toBe(true)
  })
  test('大文字小文字を区別する', () => {
    expect(keyMatches('n', ['N'])).toBe(false)
    expect(keyMatches('N', ['N'])).toBe(true)
  })
})
