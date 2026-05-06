import { describe, test, expect, beforeEach } from 'bun:test'
import { useNavStore } from '../../src/stores/nav.store'
import type { Screen } from '../../src/framework/Screen'

const mk = (id: string): Screen => ({ id, title: id, render: () => null })

describe('screen-stack flow', () => {
  beforeEach(() => {
    useNavStore.setState({
      activeTab: 'library',
      stacks: { library: [mk('albums')], queue: [mk('queue')], search: [mk('search')] },
      modal: null,
      textInputFocused: false,
    })
  })

  test('Albums で Enter (push) → AlbumDetail がトップ', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums', 'album-detail:1'])
  })

  test('AlbumDetail で Esc (pop) → Albums に戻る', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    expect(useNavStore.getState().pop()).toBe(true)
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums'])
  })

  test('Search → Artist → Album の3階層 push', () => {
    useNavStore.getState().setTab('search')
    useNavStore.getState().push(mk('artist-detail:9'))
    useNavStore.getState().push(mk('album-detail:42'))
    expect(useNavStore.getState().stacks.search.map(s => s.id)).toEqual(['search', 'artist-detail:9', 'album-detail:42'])
  })

  test('Esc 連打で順次戻る', () => {
    useNavStore.getState().setTab('search')
    useNavStore.getState().push(mk('artist-detail:9'))
    useNavStore.getState().push(mk('album-detail:42'))
    expect(useNavStore.getState().pop()).toBe(true)  // album → artist
    expect(useNavStore.getState().pop()).toBe(true)  // artist → search
    expect(useNavStore.getState().pop()).toBe(false) // root
    expect(useNavStore.getState().stacks.search.map(s => s.id)).toEqual(['search'])
  })

  test('タブ切替でスタックは保持される', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    useNavStore.getState().setTab('queue')
    useNavStore.getState().setTab('library')
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums', 'album-detail:1'])
  })

  test('モーダルはスタックと独立', () => {
    useNavStore.getState().push(mk('album-detail:1'))
    useNavStore.getState().openModal(mk('now-playing'))
    expect(useNavStore.getState().modal?.id).toBe('now-playing')
    expect(useNavStore.getState().stacks.library.map(s => s.id)).toEqual(['albums', 'album-detail:1'])
    useNavStore.getState().closeModal()
    expect(useNavStore.getState().modal).toBeNull()
  })
})
