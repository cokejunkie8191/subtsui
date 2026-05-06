// src/framework/safeLoad.ts
import { useStatusStore } from '../stores/status.store'

/**
 * 非同期処理をエラー耐性つきで実行する。
 * 失敗時は status.store にエラー報告し null を返す。
 */
export async function safeLoad<T>(
  fn: () => Promise<T>,
  errorMsg: string
): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    const msg = e instanceof Error ? `${errorMsg}: ${e.message}` : errorMsg
    useStatusStore.getState().setStatus(msg, 'error')
    return null
  }
}
