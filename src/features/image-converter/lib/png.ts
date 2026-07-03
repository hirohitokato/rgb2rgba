import { deflateZlib, inflateZlib } from './binary.ts'
import type { PngAnalysis, PngChunk } from './types.ts'

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])

const COLOR_TYPE_NAMES: Record<number, string> = {
  0: 'Grayscale',
  2: 'RGB',
  3: 'Palette',
  4: 'Grayscale + Alpha',
  6: 'RGBA',
}

const crcTable = createCrcTable()

export function isPngFile(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value)
}

export function readPngInfo(fileName: string, fileSize: number, bytes: Uint8Array): PngAnalysis {
  const chunks = parsePngChunks(bytes)
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')

  if (!ihdr) {
    throw new Error('IHDR チャンクが見つかりません。')
  }

  const view = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength)
  const width = view.getUint32(0)
  const height = view.getUint32(4)
  const bitDepth = ihdr.data[8]
  const colorType = ihdr.data[9]
  const interlace = ihdr.data[12]
  const hasICC = chunks.some((chunk) => chunk.type === 'iCCP')
  const colorTypeName = COLOR_TYPE_NAMES[colorType] ?? `type ${colorType}`

  if (colorType === 6) {
    return {
      kind: 'png',
      fileName,
      fileSize,
      width,
      height,
      bitDepth,
      hasAlpha: true,
      hasICC,
      status: 'already-rgba',
      canConvert: false,
      summary: 'すでに RGBA PNG です。',
      details: [
        `PNG / ${width} × ${height}`,
        `${bitDepth}bit / channel`,
        `colorType=6 (${colorTypeName})`,
      ],
      warnings: ['元画像はすでにアルファチャンネルを持つため、追加変換は不要です。'],
      outputSummary: '変換不要',
      colorType,
      colorTypeName,
      interlace,
      chunks,
    }
  }

  if (colorType !== 2) {
    return {
      kind: 'png',
      fileName,
      fileSize,
      width,
      height,
      bitDepth,
      hasAlpha: false,
      hasICC,
      status: 'unsupported',
      canConvert: false,
      summary: 'RGB PNG 以外は今回の対象外です。',
      details: [
        `PNG / ${width} × ${height}`,
        `${bitDepth}bit / channel`,
        `colorType=${colorType} (${colorTypeName})`,
      ],
      warnings: ['RGB から RGBA への追加専用のため、grayscale・palette 系は変換しません。'],
      outputSummary: '対象外',
      colorType,
      colorTypeName,
      interlace,
      chunks,
    }
  }

  if (interlace !== 0) {
    return {
      kind: 'png',
      fileName,
      fileSize,
      width,
      height,
      bitDepth,
      hasAlpha: false,
      hasICC,
      status: 'unsupported',
      canConvert: false,
      summary: 'Adam7 インターレース PNG は未対応です。',
      details: [
        `PNG / ${width} × ${height}`,
        `${bitDepth}bit / channel`,
        `colorType=2 (${colorTypeName})`,
      ],
      warnings: [
        'この変換は scanline を順番に復元する前提なので、Adam7 を扱うには別処理が必要です。',
      ],
      outputSummary: '対象外',
      colorType,
      colorTypeName,
      interlace,
      chunks,
    }
  }

  return {
    kind: 'png',
    fileName,
    fileSize,
    width,
    height,
    bitDepth,
    hasAlpha: false,
    hasICC,
    status: 'ready',
    canConvert: true,
    summary: `${bitDepth === 16 ? 'RGB48' : 'RGB24'} を ${
      bitDepth === 16 ? 'RGBA64' : 'RGBA32'
    } PNG に変換できます。`,
    details: [
      `PNG / ${width} × ${height}`,
      `${bitDepth}bit / channel`,
      `colorType=2 (${colorTypeName})`,
    ],
    warnings: hasICC ? ['iCCP カラープロファイルはそのまま保持されます。'] : [],
    outputSummary: `${bitDepth === 16 ? 'RGBA64' : 'RGBA32'} PNG`,
    colorType,
    colorTypeName,
    interlace,
    chunks,
  }
}

export async function convertPngRgbToRgba(analysis: PngAnalysis) {
  const bytesPerSample = analysis.bitDepth === 16 ? 2 : 1
  const rowBytes = analysis.width * 3 * bytesPerSample
  const bytesPerPixel = 3 * bytesPerSample
  const inflated = await inflateZlib(concatIdatChunks(analysis.chunks))
  const unfiltered = unfilterImage(inflated, analysis.height, rowBytes, bytesPerPixel)
  const outputRowBytes = analysis.width * 4 * bytesPerSample
  const rawOutput = new Uint8Array(analysis.height * (outputRowBytes + 1))
  const alphaBytes = bytesPerSample === 2 ? [0xff, 0xff] : [0xff]

  let sourceOffset = 0
  let destinationOffset = 0

  for (let rowIndex = 0; rowIndex < analysis.height; rowIndex += 1) {
    // 変換後の filter を None に固定することで、scanline の再フィルタ実装を増やさずに
    // 画素値だけを厳密に変更する構成へ寄せる。
    rawOutput[destinationOffset] = 0
    destinationOffset += 1

    for (let pixelIndex = 0; pixelIndex < analysis.width; pixelIndex += 1) {
      for (let sampleIndex = 0; sampleIndex < 3 * bytesPerSample; sampleIndex += 1) {
        rawOutput[destinationOffset] = unfiltered[sourceOffset]
        destinationOffset += 1
        sourceOffset += 1
      }

      for (const alphaByte of alphaBytes) {
        rawOutput[destinationOffset] = alphaByte
        destinationOffset += 1
      }
    }
  }

  const compressed = await deflateZlib(rawOutput)
  const currentIhdr = analysis.chunks.find((chunk) => chunk.type === 'IHDR')
  const newIhdr = new Uint8Array(currentIhdr?.data ?? [])

  if (newIhdr.length === 0) {
    throw new Error('IHDR の再構築に失敗しました。')
  }

  newIhdr[9] = 6

  const outputChunks: PngChunk[] = []
  let hasWrittenIdat = false

  for (const chunk of analysis.chunks) {
    if (chunk.type === 'IHDR') {
      outputChunks.push({ type: 'IHDR', data: newIhdr })
      continue
    }

    if (chunk.type === 'IDAT') {
      if (!hasWrittenIdat) {
        outputChunks.push({ type: 'IDAT', data: compressed })
        hasWrittenIdat = true
      }

      continue
    }

    outputChunks.push(chunk)
  }

  return buildPng(outputChunks)
}

export function writeChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length)
  const view = new DataView(chunk.buffer)

  view.setUint32(0, data.length)

  for (let index = 0; index < 4; index += 1) {
    chunk[4 + index] = type.charCodeAt(index)
  }

  chunk.set(data, 8)
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)))

  return chunk
}

export function parsePngChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: PngChunk[] = []
  let offset = PNG_SIGNATURE.length

  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset)
    offset += 4

    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    )
    offset += 4

    const data = bytes.subarray(offset, offset + length)
    offset += length
    offset += 4

    chunks.push({ type, data })

    if (type === 'IEND') {
      break
    }
  }

  return chunks
}

function buildPng(chunks: PngChunk[]) {
  const parts = [PNG_SIGNATURE, ...chunks.map((chunk) => writeChunk(chunk.type, chunk.data))]
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }

  return output
}

function concatIdatChunks(chunks: PngChunk[]) {
  const idatChunks = chunks.filter((chunk) => chunk.type === 'IDAT')
  const totalLength = idatChunks.reduce((sum, chunk) => sum + chunk.data.length, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of idatChunks) {
    combined.set(chunk.data, offset)
    offset += chunk.data.length
  }

  return combined
}

function unfilterImage(data: Uint8Array, height: number, rowBytes: number, bytesPerPixel: number) {
  const output = new Uint8Array(height * rowBytes)
  let inputOffset = 0

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const filterType = data[inputOffset]
    inputOffset += 1
    const rowStart = rowIndex * rowBytes

    for (let byteIndex = 0; byteIndex < rowBytes; byteIndex += 1) {
      const raw = data[inputOffset + byteIndex]
      const left = byteIndex >= bytesPerPixel ? output[rowStart + byteIndex - bytesPerPixel] : 0
      const up = rowIndex > 0 ? output[rowStart - rowBytes + byteIndex] : 0
      const upLeft =
        rowIndex > 0 && byteIndex >= bytesPerPixel
          ? output[rowStart - rowBytes + byteIndex - bytesPerPixel]
          : 0

      output[rowStart + byteIndex] = applyFilter(filterType, raw, left, up, upLeft)
    }

    inputOffset += rowBytes
  }

  return output
}

function applyFilter(filterType: number, raw: number, left: number, up: number, upLeft: number) {
  switch (filterType) {
    case 0:
      return raw
    case 1:
      return (raw + left) & 0xff
    case 2:
      return (raw + up) & 0xff
    case 3:
      return (raw + ((left + up) >> 1)) & 0xff
    case 4:
      return (raw + paeth(left, up, upLeft)) & 0xff
    default:
      throw new Error(`未知の filter type: ${filterType}`)
  }
}

function paeth(left: number, up: number, upLeft: number) {
  const predictor = left + up - upLeft
  const distanceLeft = Math.abs(predictor - left)
  const distanceUp = Math.abs(predictor - up)
  const distanceUpLeft = Math.abs(predictor - upLeft)

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left
  }

  if (distanceUp <= distanceUpLeft) {
    return up
  }

  return upLeft
}

function createCrcTable() {
  const table = new Uint32Array(256)

  for (let index = 0; index < 256; index += 1) {
    let crc = index

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }

    table[index] = crc >>> 0
  }

  return table
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff

  for (let index = 0; index < bytes.length; index += 1) {
    crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}
