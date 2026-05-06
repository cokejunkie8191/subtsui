import type { Credentials } from '../types/config'
import type { Song, Album, Artist, Playlist, SearchResult, StructuredLyrics } from '../types/subsonic'

class SubsonicError extends Error {
  constructor(public code: number, message: string, public retryable: boolean) {
    super(message)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryable(e: unknown): boolean {
  if (e instanceof SubsonicError) return e.retryable
  if (e instanceof TypeError) return true  // network error
  if (e instanceof DOMException && e.name === 'TimeoutError') return true
  return false
}

function parseSong(raw: any): Song {
  return {
    id: String(raw.id),
    title: raw.title ?? '',
    artist: raw.artist ?? '',
    artistId: String(raw.artistId ?? ''),
    album: raw.album ?? '',
    albumId: String(raw.albumId ?? ''),
    duration: Number(raw.duration ?? 0),
    rating: Number(raw.userRating ?? 0),
    genre: raw.genre,
    year: raw.year ? Number(raw.year) : undefined,
    trackNumber: raw.track ? Number(raw.track) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
    path: raw.path,
    starred: !!raw.starred,
  }
}

function parseAlbum(raw: any): Album {
  return {
    id: String(raw.id),
    name: raw.name ?? raw.title ?? '',
    artist: raw.artist ?? '',
    artistId: String(raw.artistId ?? ''),
    songCount: Number(raw.songCount ?? 0),
    duration: Number(raw.duration ?? 0),
    year: raw.year ? Number(raw.year) : undefined,
    genre: raw.genre,
    rating: Number(raw.userRating ?? 0),
    starred: !!raw.starred,
    coverArt: raw.coverArt ? String(raw.coverArt) : undefined,
  }
}

function parseArtist(raw: any): Artist {
  return {
    id: String(raw.id),
    name: raw.name ?? '',
    albumCount: Number(raw.albumCount ?? 0),
    rating: Number(raw.userRating ?? 0),
    starred: !!raw.starred,
  }
}

export class SubsonicClient {
  private creds: Credentials

  constructor(creds: Credentials) {
    this.creds = creds
  }

  private buildParams(extra: Record<string, string> = {}): URLSearchParams {
    const params = new URLSearchParams({
      v: '1.16.1',
      c: 'subtsui',
      f: 'json',
      u: this.creds.username,
      ...extra,
    })
    if (this.creds.authMethod === 'plaintext') {
      params.set('p', this.creds.password ?? '')
    } else if (this.creds.authMethod === 'hashed') {
      params.set('t', this.creds.passwordToken ?? '')
      params.set('s', this.creds.passwordSalt ?? '')
    } else if (this.creds.authMethod === 'api_key') {
      params.set('apiKey', this.creds.apiKey ?? '')
    }
    return params
  }

  private async request<T>(endpoint: string, extra: Record<string, string> = {}): Promise<T> {
    const params = this.buildParams(extra)
    const url = `${this.creds.url}/rest/${endpoint}?${params}`

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
        if (!res.ok) {
          throw new SubsonicError(res.status, res.statusText, attempt < 2)
        }
        const json = await res.json() as any
        const sr = json['subsonic-response']
        if (sr.status === 'failed') {
          throw new SubsonicError(sr.error?.code ?? -1, sr.error?.message ?? 'Unknown server error', false)
        }
        return sr as T
      } catch (e) {
        if (!isRetryable(e) || attempt === 2) throw e
        await sleep(500 * (attempt + 1))
      }
    }
    throw new Error('unreachable')
  }

  async ping(): Promise<void> {
    await this.request('ping')
  }

  async search(
    query: string,
    opts: { songCount?: number; albumCount?: number; artistCount?: number; offset?: number } = {}
  ): Promise<SearchResult> {
    const res = await this.request<any>('search3', {
      query,
      songCount: String(opts.songCount ?? 150),
      albumCount: String(opts.albumCount ?? 150),
      artistCount: String(opts.artistCount ?? 150),
      songOffset: String(opts.offset ?? 0),
    })
    const sr3 = res.searchResult3 ?? {}
    return {
      songs: (sr3.song ?? []).map(parseSong),
      albums: (sr3.album ?? []).map(parseAlbum),
      artists: (sr3.artist ?? []).map(parseArtist),
    }
  }

  async getAlbum(id: string): Promise<{ album: Album; songs: Song[] }> {
    const res = await this.request<any>('getAlbum', { id })
    return {
      album: parseAlbum(res.album),
      songs: (res.album.song ?? []).map(parseSong),
    }
  }

  async getAlbumList(
    type: 'random' | 'newest' | 'highest' | 'frequent' | 'recent' | 'starred',
    opts: { size?: number; offset?: number } = {}
  ): Promise<Album[]> {
    const res = await this.request<any>('getAlbumList2', {
      type,
      size: String(opts.size ?? 150),
      offset: String(opts.offset ?? 0),
    })
    return (res.albumList2?.album ?? []).map(parseAlbum)
  }

  async getArtist(id: string): Promise<{ artist: Artist; albums: Album[] }> {
    const res = await this.request<any>('getArtist', { id })
    return {
      artist: parseArtist(res.artist),
      albums: (res.artist.album ?? []).map(parseAlbum),
    }
  }

  async getPlaylists(): Promise<Playlist[]> {
    const res = await this.request<any>('getPlaylists')
    return (res.playlists?.playlist ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      songCount: p.songCount,
    }))
  }

  async getPlaylist(id: string): Promise<{ playlist: Playlist; songs: Song[] }> {
    const res = await this.request<any>('getPlaylist', { id })
    return {
      playlist: { id: String(res.playlist.id), name: res.playlist.name },
      songs: (res.playlist.entry ?? []).map(parseSong),
    }
  }

  async getStarred(): Promise<{ songs: Song[]; albums: Album[]; artists: Artist[] }> {
    const res = await this.request<any>('getStarred2')
    return {
      songs: (res.starred2?.song ?? []).map(parseSong),
      albums: (res.starred2?.album ?? []).map(parseAlbum),
      artists: (res.starred2?.artist ?? []).map(parseArtist),
    }
  }

  async star(id: string, type: 'song' | 'album' | 'artist'): Promise<void> {
    const key = type === 'song' ? 'id' : type === 'album' ? 'albumId' : 'artistId'
    await this.request('star', { [key]: id }).catch(() => {})
  }

  async unstar(id: string, type: 'song' | 'album' | 'artist'): Promise<void> {
    const key = type === 'song' ? 'id' : type === 'album' ? 'albumId' : 'artistId'
    await this.request('unstar', { [key]: id }).catch(() => {})
  }

  async setRating(id: string, rating: number): Promise<void> {
    await this.request('setRating', { id, rating: String(rating) }).catch(() => {})
  }

  async scrobble(id: string, opts: { submission: boolean; time?: number }): Promise<void> {
    const extra: Record<string, string> = { id, submission: String(opts.submission) }
    if (opts.time !== undefined) extra.time = String(opts.time)
    await this.request('scrobble', extra).catch(() => {})
  }

  async getLyrics(songId: string): Promise<StructuredLyrics | null> {
    try {
      const res = await this.request<any>('getLyricsBySongId', { id: songId })
      const lyrics = res.lyricsList?.structuredLyrics?.[0]
      if (!lyrics) return null
      return {
        synced: !!lyrics.synced,
        lines: (lyrics.line ?? []).map((l: any) => ({
          start: Number(l.start ?? 0),
          value: String(l.value ?? ''),
        })),
      }
    } catch {
      return null
    }
  }

  streamUrl(id: string): string {
    const params = this.buildParams({ id, maxBitRate: '0', _nonce: String(Date.now()) })
    return `${this.creds.url}/rest/stream?${params}`
  }

  coverArtUrl(id: string, size = 300): string {
    const params = this.buildParams({ id, size: String(size) })
    return `${this.creds.url}/rest/getCoverArt?${params}`
  }

  async savePlayQueue(songIds: string[], current: string, position: number): Promise<void> {
    const params = this.buildParams({ current, position: String(Math.floor(position)) })
    for (const id of songIds) params.append('id', id)
    const url = `${this.creds.url}/rest/savePlayQueue?${params}`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return
      const json = await res.json() as any
      const sr = json['subsonic-response']
      if (sr?.status === 'failed') return
    } catch {
      // swallow errors — fire and forget
    }
  }

  async getPlayQueue(): Promise<{ currentId: string; songs: Song[] } | null> {
    try {
      const res = await this.request<any>('getPlayQueue')
      if (!res.playQueue) return null
      return {
        currentId: String(res.playQueue.current ?? ''),
        songs: (res.playQueue.entry ?? []).map(parseSong),
      }
    } catch {
      return null
    }
  }
}
