import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync, inflateSync } from 'node:zlib'
import { analyzeImageFile } from '../src/features/image-converter/lib/analyze.ts'
import { deflateZlib, inflateZlib } from '../src/features/image-converter/lib/binary.ts'
import { convertPngRgbToRgba, parsePngChunks, writeChunk } from '../src/features/image-converter/lib/png.ts'

class TestFile extends Blob {
  name: string
  lastModified: number

  constructor(bits: BlobPart[], name: string, options?: BlobPropertyBag) {
    super(bits, options)
    this.name = name
    this.lastModified = Date.now()
  }
}

test('RGB24 PNG を RGBA32 PNG に変換し iCCP を保持する', async () => {
  const input = createRgbPng({
    width: 1,
    height: 1,
    bitDepth: 8,
    pixelBytes: Uint8Array.from([0x12, 0x34, 0x56]),
    extraChunks: [
      {
        type: 'iCCP',
        data: Uint8Array.from([...'ICC\0'].map((char) => char.charCodeAt(0))),
      },
    ],
  })
  const file = new TestFile([input], 'sample.png', { type: 'image/png' }) as File
  const analysis = await analyzeImageFile(file, input)

  assert.equal(analysis.kind, 'png')
  assert.equal(analysis.canConvert, true)
  assert.equal(analysis.hasICC, true)

  const output = await convertPngRgbToRgba(analysis)
  const chunks = parsePngChunks(output)
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')
  const idat = chunks.find((chunk) => chunk.type === 'IDAT')

  assert.ok(ihdr)
  assert.ok(idat)
  assert.equal(ihdr?.data[9], 6)
  assert.equal(chunks.some((chunk) => chunk.type === 'iCCP'), true)

  const raw = inflateNode(idat!.data)
  assert.deepEqual([...raw], [0x00, 0x12, 0x34, 0x56, 0xff])
})

test('RGB48 PNG を RGBA64 PNG に変換する', async () => {
  const input = createRgbPng({
    width: 1,
    height: 1,
    bitDepth: 16,
    pixelBytes: Uint8Array.from([0x11, 0x22, 0x33, 0x44, 0x55, 0x66]),
  })
  const file = new TestFile([input], 'sample16.png', { type: 'image/png' }) as File
  const analysis = await analyzeImageFile(file, input)

  assert.equal(analysis.kind, 'png')
  const output = await convertPngRgbToRgba(analysis)
  const idat = parsePngChunks(output).find((chunk) => chunk.type === 'IDAT')

  assert.ok(idat)
  assert.deepEqual(
    [...inflateNode(idat!.data)],
    [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0xff, 0xff],
  )
})

test('Adam7 PNG は未対応として弾く', async () => {
  const input = createRgbPng({
    width: 1,
    height: 1,
    bitDepth: 8,
    pixelBytes: Uint8Array.from([0xaa, 0xbb, 0xcc]),
    interlace: 1,
  })
  const file = new TestFile([input], 'adam7.png', { type: 'image/png' }) as File
  const analysis = await analyzeImageFile(file, input)

  assert.equal(analysis.kind, 'png')
  assert.equal(analysis.canConvert, false)
  assert.equal(analysis.status, 'unsupported')
})

test('大きい deflate payload でも inflateZlib が完走する', async () => {
  const raw = createPatternBytes(8_000_000)
  const compressed = new Uint8Array(deflateSync(raw))

  const restored = await inflateZlib(compressed)

  assert.equal(restored.length, raw.length)
  assert.deepEqual(restored.subarray(0, 4096), raw.subarray(0, 4096))
  assert.deepEqual(restored.subarray(-4096), raw.subarray(-4096))
})

test('deflateZlib と inflateZlib が大きい payload で往復できる', async () => {
  const raw = createPatternBytes(8_000_000)

  const compressed = await deflateZlib(raw)
  const restored = await inflateZlib(compressed)

  assert.deepEqual(restored, raw)
})

function createRgbPng(options: {
  width: number
  height: number
  bitDepth: 8 | 16
  pixelBytes: Uint8Array
  interlace?: 0 | 1
  extraChunks?: Array<{ type: string; data: Uint8Array }>
}) {
  const signature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)

  ihdrView.setUint32(0, options.width)
  ihdrView.setUint32(4, options.height)
  ihdr[8] = options.bitDepth
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = options.interlace ?? 0

  const raw = new Uint8Array(1 + options.pixelBytes.length)
  raw[0] = 0
  raw.set(options.pixelBytes, 1)

  const parts = [
    signature,
    writeChunk('IHDR', ihdr),
    ...(options.extraChunks ?? []).map((chunk) => writeChunk(chunk.type, chunk.data)),
    writeChunk('IDAT', deflateSync(raw)),
    writeChunk('IEND', new Uint8Array()),
  ]
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const png = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    png.set(part, offset)
    offset += part.length
  }

  return png
}

function inflateNode(bytes: Uint8Array) {
  return new Uint8Array(inflateSync(bytes))
}

function createPatternBytes(length: number) {
  const bytes = new Uint8Array(length)

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 31) & 0xff
  }

  return bytes
}
