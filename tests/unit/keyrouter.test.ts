// tests/unit/keyrouter.test.ts
import { describe, test, expect } from 'bun:test'
import { decideRoute } from '../../src/framework/routing'
import { detectDoubleTap } from '../../src/framework/quit'
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

describe('detectDoubleTap', () => {
  test('q q を 300ms 以内に押すと quit', () => {
    const last = Date.now() - 200
    expect(detectDoubleTap('q', last, Date.now())).toBe('quit')
  })

  test('q q でも 300ms 以上経過していると first-tap', () => {
    const last = Date.now() - 400
    expect(detectDoubleTap('q', last, Date.now())).toBe('first-tap')
  })

  test('q の初回タップは first-tap（lastTap=0）', () => {
    expect(detectDoubleTap('q', 0, Date.now())).toBe('first-tap')
  })

  test('Z は q q quit に反応しない', () => {
    const last = Date.now() - 100
    expect(detectDoubleTap('Z', last, Date.now())).toBe('ignored')
  })

  test('別のキーは ignored', () => {
    const last = Date.now() - 100
    expect(detectDoubleTap('n', last, Date.now())).toBe('ignored')
  })
})

describe('resolveActiveScreen', () => {
  test('modal があれば modal を返す', async () => {
    const { resolveActiveScreen } = await import('../../src/framework/routing')
    const m: Screen = { ...baseScreen, id: 'm' }
    const top: Screen = { ...baseScreen, id: 'top' }
    expect(resolveActiveScreen(m, top)?.id).toBe('m')
  })

  test('modal なしなら topOfStack を返す', async () => {
    const { resolveActiveScreen } = await import('../../src/framework/routing')
    const top: Screen = { ...baseScreen, id: 'top' }
    expect(resolveActiveScreen(null, top)?.id).toBe('top')
  })

  test('両方なしなら null', async () => {
    const { resolveActiveScreen } = await import('../../src/framework/routing')
    expect(resolveActiveScreen(null, undefined)).toBeNull()
  })
})
