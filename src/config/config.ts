import { parse } from 'smol-toml'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { AppConfig, Credentials } from '../types/config'
import { DEFAULT_CONFIG } from './defaults'

export function mergeConfig<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults }
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const val = overrides[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof defaults[key] === 'object') {
      result[key] = mergeConfig(defaults[key] as any, val as any)
    } else if (val !== undefined) {
      result[key] = val as T[keyof T]
    }
  }
  return result
}

function tomlToAppConfig(raw: Record<string, any>): Partial<AppConfig> {
  const out: any = {}
  if (raw.app) {
    out.app = {
      defaultVolume: raw.app.default_volume,
      gaplessPlayback: raw.app.gapless_playback,
      replaygain: raw.app.replaygain,
      notifications: raw.app.notifications,
      scrobbleSubmission: raw.app.scrobble_submission,
    }
  }
  if (raw.theme) out.theme = raw.theme
  if (raw.filters) {
    out.filters = {
      minDuration: raw.filters.min_duration,
      titles: raw.filters.titles,
      genres: raw.filters.genres,
      excludeFavorites: raw.filters.exclude_favorites,
    }
  }
  if (raw.columns) out.columns = raw.columns
  if (raw.keybinds) out.keybinds = raw.keybinds
  return out
}

export async function loadConfig(configDir?: string): Promise<AppConfig> {
  const dir = configDir ?? join(homedir(), '.config', 'subtsui')
  try {
    const raw = await readFile(join(dir, 'config.toml'), 'utf8')
    const parsed = parse(raw) as Record<string, any>
    return mergeConfig(DEFAULT_CONFIG, tomlToAppConfig(parsed))
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function loadCredentials(configDir?: string): Promise<Credentials | null> {
  const dir = configDir ?? join(homedir(), '.config', 'subtsui')
  try {
    const raw = await readFile(join(dir, 'credentials.toml'), 'utf8')
    const parsed = parse(raw) as any
    if (!parsed?.server?.url || !parsed?.server?.username) return null
    return {
      url: parsed.server.url.replace(/\/$/, ''),
      authMethod: parsed.server.auth_method ?? 'plaintext',
      username: parsed.server.username,
      password: parsed.server.password,
      passwordToken: parsed.server.password_token,
      passwordSalt: parsed.server.password_salt,
      apiKey: parsed.server.api_key,
    }
  } catch {
    return null
  }
}

export async function saveCredentials(creds: Credentials, configDir?: string): Promise<void> {
  const dir = configDir ?? join(homedir(), '.config', 'subtsui')
  await mkdir(dir, { recursive: true })
  const lines = [
    '[server]',
    `url = "${creds.url}"`,
    `auth_method = "${creds.authMethod}"`,
    `username = "${creds.username}"`,
  ]
  if (creds.password) lines.push(`password = "${creds.password}"`)
  if (creds.passwordToken) lines.push(`password_token = "${creds.passwordToken}"`)
  if (creds.passwordSalt) lines.push(`password_salt = "${creds.passwordSalt}"`)
  if (creds.apiKey) lines.push(`api_key = "${creds.apiKey}"`)
  await writeFile(join(dir, 'credentials.toml'), lines.join('\n') + '\n', { mode: 0o600 })
}
