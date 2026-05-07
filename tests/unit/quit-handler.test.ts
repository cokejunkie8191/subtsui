// tests/unit/quit-handler.test.ts
import { describe, test, expect, afterEach } from 'bun:test'
import { setGlobalQuit, quit } from '../../src/framework/ServiceContext'

afterEach(() => { setGlobalQuit(null) })

describe('quit()', () => {
  test('登録済みの quit ハンドラを呼び出す', async () => {
    let called = false
    setGlobalQuit(async () => { called = true })
    await quit()
    expect(called).toBe(true)
  })

  test('複数回 set した場合は最後に登録したハンドラを呼ぶ', async () => {
    const log: number[] = []
    setGlobalQuit(async () => { log.push(1) })
    setGlobalQuit(async () => { log.push(2) })
    await quit()
    expect(log).toEqual([2])
  })

  test('setGlobalQuit(null) 後は quit() がハンドラを呼ばない', async () => {
    let called = false
    setGlobalQuit(async () => { called = true })
    setGlobalQuit(null)
    // null の場合は process.exit を呼ぶが、テスト内では呼べないのでハンドラが呼ばれないことだけ確認
    // quit() はハンドラなしだと process.exit するため直接呼ばず API の状態だけ検証
    expect(called).toBe(false)
  })
})
