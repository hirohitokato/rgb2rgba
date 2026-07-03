import type { JpegAnalysis } from './types.ts'

export function isJpegFile(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8
}

export function readJpegInfo(
  fileName: string,
  fileSize: number,
  bytes: Uint8Array,
): JpegAnalysis {
  const sof = readSofSegment(bytes)
  const hasICC = extractJpegIccProfile(bytes) !== null
  const colorModel = describeJpegColorModel(sof.components)

  return {
    kind: 'jpeg',
    fileName,
    fileSize,
    width: sof.width,
    height: sof.height,
    bitDepth: sof.precision,
    hasAlpha: false,
    hasICC,
    status: 'ready',
    canConvert: true,
    summary: 'JPEG を不透明アルファ付き PNG として出力します。',
    details: [
      `JPEG / ${sof.width} × ${sof.height}`,
      `${sof.precision}bit / channel`,
      sof.isProgressive ? 'progressive' : 'baseline',
    ],
    warnings: [
      'JPEG はアルファチャンネルを持てないため、出力PNGでは alpha=255 を付与します。',
      hasICC
        ? 'JPEG の ICC は decode 時点で色変換済みの可能性があるため、誤タグ付けを避けて再埋め込みしません。'
        : '出力PNGはブラウザデコード後の色をそのまま保存します。',
    ],
    outputSummary: 'RGBA32 PNG',
    components: sof.components,
    colorModel,
    isProgressive: sof.isProgressive,
  }
}

export async function convertJpegToPng(bytes: Uint8Array) {
  const blob = new Blob([cloneAsArrayBuffer(bytes)], { type: 'image/jpeg' })
  const bitmap = await createImageBitmap(blob)
  const canvas =
    'OffscreenCanvas' in window
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement('canvas'), {
          width: bitmap.width,
          height: bitmap.height,
        })

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('2D canvas の初期化に失敗しました。')
  }

  context.drawImage(bitmap, 0, 0)

  // decode 済みピクセルを PNG 化するだけに留めることで、
  // ICC を「元JPEGのまま」誤って残してしまう事故を避ける。
  const blobResult =
    'convertToBlob' in canvas
      ? await canvas.convertToBlob({ type: 'image/png' })
      : await new Promise<Blob>((resolve, reject) => {
          ;(canvas as HTMLCanvasElement).toBlob((value) => {
            if (!value) {
              reject(new Error('PNG への書き出しに失敗しました。'))
              return
            }

            resolve(value)
          }, 'image/png')
        })

  return new Uint8Array(await blobResult.arrayBuffer())
}

function cloneAsArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function readSofSegment(bytes: Uint8Array) {
  let offset = 2

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }

    if (marker === 0xd9) {
      break
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3]

    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        precision: bytes[offset + 4],
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        components: bytes[offset + 9],
        isProgressive: marker === 0xc2,
      }
    }

    offset += 2 + segmentLength
  }

  throw new Error('SOF マーカーが見つかりません。')
}

function extractJpegIccProfile(bytes: Uint8Array) {
  let offset = 2
  const parts: Array<{ sequence: number; data: Uint8Array }> = []

  while (offset < bytes.length - 4) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = bytes[offset + 1]

    if (marker === 0xd9 || marker === 0xda) {
      break
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }

    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3]

    if (marker === 0xe2 && segmentLength >= 16) {
      let identifier = ''

      for (let index = 0; index < 12; index += 1) {
        identifier += String.fromCharCode(bytes[offset + 4 + index])
      }

      if (identifier === 'ICC_PROFILE\0') {
        parts.push({
          sequence: bytes[offset + 16],
          data: bytes.subarray(offset + 18, offset + 2 + segmentLength),
        })
      }
    }

    offset += 2 + segmentLength
  }

  if (parts.length === 0) {
    return null
  }

  parts.sort((left, right) => left.sequence - right.sequence)
  const totalLength = parts.reduce((sum, part) => sum + part.data.length, 0)
  const profile = new Uint8Array(totalLength)
  let writeOffset = 0

  for (const part of parts) {
    profile.set(part.data, writeOffset)
    writeOffset += part.data.length
  }

  return profile
}

function describeJpegColorModel(components: number) {
  if (components === 1) {
    return 'Grayscale'
  }

  if (components === 3) {
    return 'YCbCr / RGB'
  }

  if (components === 4) {
    return 'CMYK'
  }

  return `components=${components}`
}
