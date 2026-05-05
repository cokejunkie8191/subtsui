import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { SubsonicClient } from '../../src/services/subsonic'

// モックサーバー（Bun の serve を使用）
let server: ReturnType<typeof Bun.serve>
let client: SubsonicClient

beforeAll(() => {
  server = Bun.serve({
    port: 19876,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/rest/ping') {
        return Response.json({
          'subsonic-response': { status: 'ok', version: '1.16.1' }
        })
      }
      if (url.pathname === '/rest/search3') {
        return Response.json({
          'subsonic-response': {
            status: 'ok',
            version: '1.16.1',
            searchResult3: {
              song: [{ id: '1', title: 'Test Song', artist: 'Test', album: 'Test Album', duration: 180 }],
              album: [],
              artist: [],
            }
          }
        })
      }
      return new Response('Not found', { status: 404 })
    }
  })

  client = new SubsonicClient({
    url: 'http://localhost:19876',
    authMethod: 'plaintext',
    username: 'test',
    password: 'test',
  })
})

afterAll(() => server.stop())

test('ping が成功する', async () => {
  await expect(client.ping()).resolves.toBeUndefined()
})

test('search3 が Song 配列を返す', async () => {
  const result = await client.search('Test', { songCount: 10, albumCount: 0, artistCount: 0 })
  expect(result.songs).toHaveLength(1)
  expect(result.songs[0].title).toBe('Test Song')
  expect(result.songs[0].duration).toBe(180)
})
