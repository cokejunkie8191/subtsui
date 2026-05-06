// src/framework/WindowList.tsx
import React from 'react'
import { Box } from 'ink'

type Props<T> = {
  items: T[]
  cursor: number
  height: number   // 表示行数
  renderItem: (item: T, index: number, isCursor: boolean) => React.ReactNode
}

/**
 * カーソル位置を中心に固定行数だけ render する。
 * - cursor が窓の上端／下端に近づいたら窓をスライド。
 * - items.length <= height なら全件表示。
 */
export function WindowList<T>({ items, cursor, height, renderItem }: Props<T>) {
  if (items.length === 0) return null

  // 窓の開始位置を決める（カーソルを中央あたりに保つ）
  const half = Math.floor(height / 2)
  let start = cursor - half
  if (start < 0) start = 0
  if (start + height > items.length) start = Math.max(0, items.length - height)
  const end = Math.min(items.length, start + height)

  const slice = items.slice(start, end)

  return (
    <Box flexDirection="column">
      {slice.map((item, i) => {
        const absIndex = start + i
        return (
          <React.Fragment key={absIndex}>
            {renderItem(item, absIndex, absIndex === cursor)}
          </React.Fragment>
        )
      })}
    </Box>
  )
}
