# SubTSUI

A Subsonic-compatible terminal music player, written in TypeScript.

Album-first browsing, configurable keybindings, accurate Last.fm Now Playing
notifications, terminal-rendered cover art, and a layered keyboard input model
that plays nicely with text inputs.

> Status: **MVP** — core playback is solid. See [Roadmap](#roadmap) for what is
> intentionally not yet built.

## Features

- **Album-first browsing** with paginated incremental loading
- **Search** with drill-down: Songs / Albums / Artists → Album → tracks
- **Queue management**: auto-fill on album play, jump-to, remove, clear
- **MPV-based playback**: gapless, ReplayGain, seek, loop modes (none / all / one)
- **Last.fm Now Playing** via Subsonic scrobble (immediate notification)
- **Position-based completion scrobble** that respects pause (configurable)
- **Cover art** in the Now Playing modal (Unicode block rendering)
- **Desktop notifications** on track change (macOS / Linux)
- **3-layer keyboard routing** that does not conflict with text inputs
- **Configurable keybindings** via TOML

## Requirements

- [Bun](https://bun.sh) ≥ 1.0
- [mpv](https://mpv.io) on `$PATH`
- A Subsonic-compatible server (Navidrome, Airsonic, Gonic, …)
- A terminal that supports 24-bit color

## Installation

```sh
git clone https://github.com/cokejunkie8191/subtsui.git
cd subtsui
bun install
```

## Quick start

```sh
bun run src/main.tsx
```

On first run you will see a login screen. Enter your Subsonic server URL,
username, and password. Credentials are saved to
`~/.config/subtsui/credentials.toml` (mode `0600`).

## Configuration

Settings live at `~/.config/subtsui/config.toml`. The file is optional —
defaults apply when missing.

```toml
[app]
default_volume      = 80
gapless_playback    = "yes"      # yes | no | weak
replaygain          = "track"    # track | album | no
notifications       = true
scrobble_submission = true       # set false if your server already scrobbles to Last.fm

[theme]
highlight = "#7dd3fc"
subtle    = "#6b7280"
special   = "#f472b6"

# Override any keybinding by category. See src/config/defaults.ts for the full list.
[keybinds.global]
play_pause = ["space"]
next       = ["n"]
prev       = ["p"]

[keybinds.navigation]
up   = ["k", "up"]
down = ["j", "down"]
```

## Keybindings

### Global (Layer 1, always active)

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `n` / `p` | Next / Previous track |
| `+` / `-` | Volume ± 5 |
| `<` / `>` | Seek ± 10 sec |
| `.` | Restart current track |
| `l` | Cycle loop mode (none → all → one) |
| `M` | Toggle Now Playing modal |
| `Tab` / `Shift+Tab` | Cycle tabs |
| `1` / `2` / `3` | Library / Queue / Search |
| `/` | Jump to Search |
| `Z Z` | Quit (double-tap within 300 ms) |
| `Ctrl+C` | Force quit |

### Screen-local (Layer 2)

| Key | Common meaning |
| --- | --- |
| `j` / `k` | Cursor down / up |
| `g` / `G` | Top / Bottom of list |
| `Enter` | Select / Play |
| `Esc` / `h` | Back |

Screen-specific extras:

- **AlbumDetail**: `Enter` plays the cursor track and queues the rest of the
  album; `q` adds the cursor track to the queue, `Q` adds the whole album.
- **Queue**: `x` removes the cursor row, `X` clears the queue.
- **Search**: `/` returns from results to the input field; `Tab` cycles
  filter (Songs / Albums / Artists) while in results mode.

## Image protocol

Cover art is rendered with Unicode upper-half blocks (`▀`) plus ANSI 24-bit
color. This works in any modern terminal but is lower-fidelity than native
graphics protocols.

Kitty graphics protocol and iTerm2 inline images are **not** supported through
Ink today: Ink's text-wrapping splits the long base64 payload and breaks the
escape sequence. Working around it requires bypassing Ink's layout. Set
`SUBTSUI_IMAGE_PROTOCOL=kitty` to experiment, but expect garbled output until a
proper bypass implementation lands.

## Architecture (in 30 seconds)

```
src/
  framework/   # app-agnostic: Screen interface, KeyRouter, WindowList, safeLoad
  stores/      # Zustand: player, queue, nav (tabs + per-tab stacks), library, status
  services/    # Subsonic, MPV IPC, scrobble, image, notify
  screens/     # Screen implementations
  components/  # pure display
```

Three principles drive the design:

1. **Three-layer keyboard routing** — global keys, screen-local keys, and a
   text-input modal layer that suspends both during text entry. This prevents
   the bug-magnet of one giant key dispatcher.
2. **Per-tab history stack** — each tab has its own navigation stack
   (`Albums → AlbumDetail`, `Search → Artist → Album`, …) so back-navigation is
   predictable.
3. **Stores are independent** — no store imports another. Cross-store
   coordination lives in the call site (`app.tsx` and `Screen.onKey`).

For the long version, see [`docs/steering/`](docs/steering).

## Development

```sh
bun run typecheck     # tsc --noEmit
bun test              # unit + integration
bun run src/main.tsx  # start the app
```

## Roadmap

Deferred from the MVP, in roughly this order of likelihood:

- All Songs / Artists / Playlists / Starred views in the Library tab
- Star / rating / add-to-playlist actions
- Settings UI (currently TOML only)
- Help overlay (`?`)
- `savePlayQueue` (server-side queue sync across clients)
- Native cover-art rendering via Kitty / iTerm2 (requires bypassing Ink layout)
- Run-on-host / play-on-client over SSH (forward MPV's IPC socket)

## Acknowledgments

Inspired by **SubTUI**, the Go + Bubble Tea Subsonic terminal player. SubTSUI
keeps the spirit but reworks the architecture around React (Ink), Zustand, and
a three-layer keyboard input model.

## License

TBD.
