import type { AppConfig } from '../types/config'

export const DEFAULT_CONFIG: AppConfig = {
  app: {
    defaultVolume: 80,
    gaplessPlayback: 'yes',
    replaygain: 'track',
    notifications: true,
  },
  theme: {
    highlight: '#7dd3fc',
    subtle: '#6b7280',
    special: '#f472b6',
  },
  filters: {
    minDuration: 0,
    titles: [],
    genres: [],
    excludeFavorites: false,
  },
  columns: {
    songs: {
      trackNumber: true,
      title: true,
      artist: true,
      album: true,
      year: true,
      rating: true,
      duration: true,
    },
  },
  keybinds: {
    // Layer 1: Always-on global
    global: {
      play_pause:        ['space'],
      next:              ['n'],
      prev:              ['p'],
      volume_up:         ['+', '='],
      volume_down:       ['-'],
      rewind:            ['<'],
      forward:           ['>'],
      restart:           ['.'],
      loop:              ['l'],
      toggle_now_playing:['M'],
      tab_next:          ['tab'],
      tab_prev:          ['S-tab'],
      tab_1:             ['1'],
      tab_2:             ['2'],
      tab_3:             ['3'],
      search_jump:       ['/'],
      quit:              ['Z'],
    },
    // Layer 2: Common screen-local
    navigation: {
      up:     ['k', 'up'],
      down:   ['j', 'down'],
      top:    ['g'],
      bottom: ['G'],
      select: ['return'],
      back:   ['escape', 'h'],
    },
  },
}
