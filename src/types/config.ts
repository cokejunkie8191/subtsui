export type AuthMethod = 'plaintext' | 'hashed' | 'api_key'

export type Credentials = {
  url: string
  authMethod: AuthMethod
  username: string
  password?: string
  passwordToken?: string
  passwordSalt?: string
  apiKey?: string
}

export type ThemeConfig = {
  highlight: string
  subtle: string
  special: string
}

export type FiltersConfig = {
  minDuration: number
  titles: string[]
  genres: string[]
  excludeFavorites: boolean
}

export type ColumnsConfig = {
  trackNumber: boolean
  title: boolean
  artist: boolean
  album: boolean
  year: boolean
  rating: boolean
  duration: boolean
}

export type AppConfig = {
  app: {
    defaultVolume: number
    gaplessPlayback: 'yes' | 'no' | 'weak'
    replaygain: 'track' | 'album' | 'no'
    notifications: boolean
  }
  theme: ThemeConfig
  filters: FiltersConfig
  columns: { songs: ColumnsConfig }
  keybinds: Record<string, Record<string, string[]>>
}
