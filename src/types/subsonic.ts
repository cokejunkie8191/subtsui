export type Song = {
  id: string
  title: string
  artist: string
  artistId: string
  album: string
  albumId: string
  duration: number      // 秒
  rating: number        // 0-5
  genre?: string
  year?: number
  trackNumber?: number
  playCount?: number
  path?: string
  starred?: boolean
}

export type Album = {
  id: string
  name: string
  artist: string
  artistId: string
  songCount: number
  duration: number
  year?: number
  genre?: string
  rating: number
  starred?: boolean
  coverArt?: string
}

export type Artist = {
  id: string
  name: string
  albumCount: number
  rating: number
  starred?: boolean
}

export type Playlist = {
  id: string
  name: string
  songCount?: number
}

export type LyricLine = {
  start: number   // ミリ秒
  value: string
}

export type StructuredLyrics = {
  synced: boolean
  lines: LyricLine[]
}

export type SearchResult = {
  artists: Artist[]
  albums: Album[]
  songs: Song[]
}
