import { describe, it, expect, vi, afterEach } from 'vitest'
import sharp from 'sharp'
import { loadAndValidateImage, pickValidImage } from './imageValidation'

async function makeTestImage(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } }).png().toBuffer()
  return new Uint8Array(buffer)
}

// Fake mínimo de Response — evita pelear con el tipado de BodyInit del
// Response global (Buffer/Uint8Array chocan con las declaraciones de tipos
// combinadas de DOM + Node en este proyecto) y solo implementa lo que
// loadAndValidateImage realmente usa: ok, status, headers.get, arrayBuffer.
function mockResponse(body: Uint8Array | string | null, opts: { status?: number; contentType?: string } = {}) {
  const status = opts.status ?? 200
  const contentType = opts.contentType ?? 'application/octet-stream'
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    async arrayBuffer() {
      if (body == null) return new ArrayBuffer(0)
      const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    },
  }
}

describe('loadAndValidateImage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('rechaza una URL vacía', async () => {
    const result = await loadAndValidateImage('')
    expect(result.ok).toBe(false)
  })

  it('rechaza cuando el fetch falla (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(null, { status: 404 })))
    const result = await loadAndValidateImage('https://example.com/x.jpg')
    expect(result.ok).toBe(false)
  })

  it('rechaza cuando content-type no es imagen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse('<html></html>', { contentType: 'text/html' })))
    const result = await loadAndValidateImage('https://example.com/x.jpg')
    expect(result.ok).toBe(false)
  })

  it('rechaza una imagen más chica que 300x300 (naturalWidth/Height)', async () => {
    const small = await makeTestImage(100, 100)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(small, { contentType: 'image/png' })))
    const result = await loadAndValidateImage('https://example.com/x.jpg')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('too_small')
  })

  it('acepta una imagen válida >= 300x300 y la reencoda', async () => {
    const valid = await makeTestImage(600, 800)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(valid, { contentType: 'image/png' })))
    const result = await loadAndValidateImage('https://example.com/x.jpg')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.width).toBeGreaterThanOrEqual(300)
      expect(result.height).toBeGreaterThanOrEqual(300)
      expect(result.buffer.length).toBeGreaterThan(0)
    }
  })
})

describe('pickValidImage — orden de fallback', () => {
  afterEach(() => vi.restoreAllMocks())

  it('usa la primera foto si es válida y no prueba las demás', async () => {
    const valid = await makeTestImage(600, 800)
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(valid, { contentType: 'image/png' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await pickValidImage(['https://example.com/a.jpg', 'https://example.com/b.jpg'])
    expect(result).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('si la primera foto falla, prueba la siguiente de la misma prenda', async () => {
    const valid = await makeTestImage(600, 800)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse(null, { status: 404 }))
      .mockResolvedValueOnce(mockResponse(valid, { contentType: 'image/png' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await pickValidImage(['https://example.com/a.jpg', 'https://example.com/b.jpg'])
    expect(result).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('si todas las fotos de la prenda fallan, devuelve null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse(null, { status: 404 })))
    const result = await pickValidImage(['https://example.com/a.jpg', 'https://example.com/b.jpg'])
    expect(result).toBeNull()
  })

  it('sin fotos devuelve null', async () => {
    const result = await pickValidImage([])
    expect(result).toBeNull()
  })
})
