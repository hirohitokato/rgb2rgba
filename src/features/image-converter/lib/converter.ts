import { baseName } from './format.ts'
import { convertJpegToPng } from './jpeg.ts'
import { convertPngRgbToRgba } from './png.ts'
import type { AnalyzedImage, ConversionOutput } from './types.ts'

export async function convertImageToRgbaPng(
  file: File,
  bytes: Uint8Array,
  analysis: AnalyzedImage,
): Promise<ConversionOutput> {
  if (!analysis.canConvert) {
    throw new Error('現在の画像は変換対象ではありません。')
  }

  const filename = `${baseName(file.name)}_rgba.png`

  if (analysis.kind === 'png') {
    return {
      bytes: await convertPngRgbToRgba(analysis),
      filename,
    }
  }

  return {
    bytes: await convertJpegToPng(bytes),
    filename,
  }
}
