// src/framework/textWidth.ts
import stringWidth from 'string-width'

/**
 * 表示幅（terminal cell 数）で文字列を切り詰め、指定幅まで右パディングする。
 * CJK 全角文字は 2 cells、半角は 1 cell として計算。
 *
 * - 文字列が width 以下の幅なら、右をスペースでパディングして width に揃える
 * - 文字列が width を超えるなら、末尾を '…' に置き換えて width に揃える
 */
export function padTruncate(s: string, width: number): string {
  const w = stringWidth(s)
  if (w <= width) return s + ' '.repeat(width - w)

  // 末尾 1 cell 分を '…' に空けて切り詰め
  let used = 0
  let cut = ''
  for (const ch of s) {
    const cw = stringWidth(ch)
    if (used + cw > width - 1) break
    cut += ch
    used += cw
  }
  return cut + '…' + ' '.repeat(Math.max(0, width - used - 1))
}
