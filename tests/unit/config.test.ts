import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig, mergeConfig } from '../../src/config/config'
import type { AppConfig } from '../../src/types/config'

describe('mergeConfig', () => {
  test('ユーザー設定でデフォルトを上書きする', () => {
    const defaults = { app: { defaultVolume: 80, notifications: true } }
    const user = { app: { defaultVolume: 60 } }
    const result = mergeConfig(defaults as any, user as any)
    expect(result.app.defaultVolume).toBe(60)
    expect(result.app.notifications).toBe(true)
  })

  test('ネストしたオブジェクトを再帰的にマージする', () => {
    const defaults = { theme: { highlight: '#fff', subtle: '#888' } }
    const user = { theme: { highlight: '#0af' } }
    const result = mergeConfig(defaults as any, user as any)
    expect(result.theme.highlight).toBe('#0af')
    expect(result.theme.subtle).toBe('#888')
  })
})

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tuimusic-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true })
  })

  test('設定ファイルが存在しない場合はデフォルトを返す', async () => {
    const config = await loadConfig(join(tmpDir, 'nonexistent'))
    expect(config.app.defaultVolume).toBe(80)
  })

  test('TOML ファイルを読み込んでデフォルトとマージする', async () => {
    await writeFile(join(tmpDir, 'config.toml'), `
[app]
default_volume = 60
`)
    const config = await loadConfig(tmpDir)
    expect(config.app.defaultVolume).toBe(60)
    expect(config.app.notifications).toBe(true)
  })
})
