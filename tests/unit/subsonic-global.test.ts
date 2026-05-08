// tests/unit/subsonic-global.test.ts
import { describe, test, expect, afterEach } from 'bun:test'
import { setGlobalSubsonic, getGlobalSubsonic } from '../../src/framework/ServiceContext'

afterEach(() => { setGlobalSubsonic(null) })

describe('setGlobalSubsonic / getGlobalSubsonic', () => {
  test('登録した subsonic を取得できる', () => {
    const fake = { getAlbum: async () => ({ album: {}, songs: [] }) } as any
    setGlobalSubsonic(fake)
    expect(getGlobalSubsonic()).toBe(fake)
  })

  test('null をセットすると null が返る', () => {
    const fake = {} as any
    setGlobalSubsonic(fake)
    setGlobalSubsonic(null)
    expect(getGlobalSubsonic()).toBeNull()
  })

  test('未登録時は null', () => {
    expect(getGlobalSubsonic()).toBeNull()
  })
})
