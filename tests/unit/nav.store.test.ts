// tests/unit/nav.store.test.ts
import { describe, test, expect, beforeEach } from 'bun:test'
import { useNavStore } from '../../src/stores/nav.store'
import type { Screen } from '../../src/framework/Screen'

const makeScreen = (id: string): Screen => ({
  id,
  title: id,
  render: () => null,
})

describe('nav.store', () => {
  beforeEach(() => {
    useNavStore.setState({
      activeTab: 'library',
      stacks: { library: [], queue: [], search: [] },
      modal: null,
      textInputFocused: false,
    })
  })

  test('push: 現在タブのスタック末尾に追加される', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.push(makeScreen('b'))
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a', 'b'])
  })

  test('push: 他タブのスタックには影響しない', () => {
    useNavStore.getState().push(makeScreen('a'))
    expect(useNavStore.getState().stacks.queue).toEqual([])
    expect(useNavStore.getState().stacks.search).toEqual([])
  })

  test('pop: 最後の要素を削除して true を返す', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.push(makeScreen('b'))
    expect(s.pop()).toBe(true)
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('pop: ルート（要素1個以下）では false を返す', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    expect(s.pop()).toBe(false)
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('replace: 末尾を新スクリーンに置き換える', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.push(makeScreen('b'))
    s.replace(makeScreen('c'))
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a', 'c'])
  })

  test('replace: 空スタックなら追加と同じ', () => {
    useNavStore.getState().replace(makeScreen('a'))
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('replaceStack: 指定タブのスタック全体を置き換える', () => {
    const s = useNavStore.getState()
    s.replaceStack('queue', [makeScreen('q1'), makeScreen('q2')])
    expect(useNavStore.getState().stacks.queue.map(x => x.id)).toEqual(['q1', 'q2'])
  })

  test('setTab: スタックは保持される', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.setTab('queue')
    expect(useNavStore.getState().activeTab).toBe('queue')
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
  })

  test('openModal/closeModal: スタックとは独立', () => {
    const s = useNavStore.getState()
    s.push(makeScreen('a'))
    s.openModal(makeScreen('m'))
    expect(useNavStore.getState().modal?.id).toBe('m')
    expect(useNavStore.getState().stacks.library.map(x => x.id)).toEqual(['a'])
    s.closeModal()
    expect(useNavStore.getState().modal).toBeNull()
  })

  test('setTextInputFocused: フラグが反映される', () => {
    useNavStore.getState().setTextInputFocused(true)
    expect(useNavStore.getState().textInputFocused).toBe(true)
    useNavStore.getState().setTextInputFocused(false)
    expect(useNavStore.getState().textInputFocused).toBe(false)
  })
})
