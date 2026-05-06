// tests/unit/keyrouter.test.ts
import { describe, test, expect } from 'bun:test'
import { decideRoute } from '../../src/framework/keyRouter'
import type { Screen, KeyEvent } from '../../src/framework/Screen'

const baseScreen: Screen = {
  id: 'test',
  title: 'test',
  render: () => null,
}

const ev = (input: string, key: Partial<KeyEvent['key']> = {}): KeyEvent => ({ input, key })

describe('decideRoute', () => {
  test('Layer 3 ON で Esc 以外は "blocked"', () => {
    const r = decideRoute(ev('j'), { textInputFocused: true, screen: baseScreen, modal: null })
    expect(r).toBe('blocked')
  })

  test('Layer 3 ON でも Esc は "screen"', () => {
    const r = decideRoute(ev('', { escape: true }), { textInputFocused: true, screen: baseScreen, modal: null })
    expect(r).toBe('screen')
  })

  test('通常時は "screen"', () => {
    const r = decideRoute(ev('j'), { textInputFocused: false, screen: baseScreen, modal: null })
    expect(r).toBe('screen')
  })

  test('modal が isModal=true なら Layer 1 はスキップ → "screen-only"', () => {
    const modal: Screen = { ...baseScreen, id: 'modal', isModal: true }
    const r = decideRoute(ev('Space'), { textInputFocused: false, screen: baseScreen, modal })
    expect(r).toBe('screen-only')
  })

  test('modal が isModal=false なら通常通り Layer 1 まで進める', () => {
    const modal: Screen = { ...baseScreen, id: 'modal', isModal: false }
    const r = decideRoute(ev('Space'), { textInputFocused: false, screen: baseScreen, modal })
    expect(r).toBe('screen')
  })

  test('modal なしの通常時: "screen"', () => {
    const r = decideRoute(ev('n'), { textInputFocused: false, screen: baseScreen, modal: null })
    expect(r).toBe('screen')
  })

  test('screen 自体が isModal=true でも同様にスキップ', () => {
    const modalScreen: Screen = { ...baseScreen, id: 'm', isModal: true }
    const r = decideRoute(ev('n'), { textInputFocused: false, screen: modalScreen, modal: null })
    expect(r).toBe('screen-only')
  })
})

describe('resolveActiveScreen', () => {
  test('modal があれば modal を返す', async () => {
    const { resolveActiveScreen } = await import('../../src/framework/keyRouter')
    const m: Screen = { ...baseScreen, id: 'm' }
    const top: Screen = { ...baseScreen, id: 'top' }
    expect(resolveActiveScreen(m, top)?.id).toBe('m')
  })

  test('modal なしなら topOfStack を返す', async () => {
    const { resolveActiveScreen } = await import('../../src/framework/keyRouter')
    const top: Screen = { ...baseScreen, id: 'top' }
    expect(resolveActiveScreen(null, top)?.id).toBe('top')
  })

  test('両方なしなら null', async () => {
    const { resolveActiveScreen } = await import('../../src/framework/keyRouter')
    expect(resolveActiveScreen(null, undefined)).toBeNull()
  })
})
