import { isJpegFile, readJpegInfo } from './jpeg.ts'
import { isPngFile, readPngInfo } from './png.ts'
import type { AnalyzedImage } from './types.ts'

export async function analyzeImageFile(file: File, bytes: Uint8Array): Promise<AnalyzedImage> {
  try {
    if (isPngFile(bytes)) {
      return readPngInfo(file.name, file.size, bytes)
    }

    if (isJpegFile(bytes)) {
      return readJpegInfo(file.name, file.size, bytes)
    }

    return {
      kind: 'unknown',
      fileName: file.name,
      fileSize: file.size,
      width: null,
      height: null,
      bitDepth: null,
      hasAlpha: false,
      hasICC: false,
      status: 'error',
      canConvert: false,
      summary: 'PNG または JPEG と判定できませんでした。',
      details: ['対応形式は PNG / JPEG のみです。'],
      warnings: ['ファイル署名が一致しないため、処理を中断しました。'],
      outputSummary: '変換不可',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明な解析エラー'

    return {
      kind: 'unknown',
      fileName: file.name,
      fileSize: file.size,
      width: null,
      height: null,
      bitDepth: null,
      hasAlpha: false,
      hasICC: false,
      status: 'error',
      canConvert: false,
      summary: '画像の解析に失敗しました。',
      details: ['ファイルヘッダの読み取り中にエラーが発生しました。'],
      warnings: [message],
      outputSummary: '変換不可',
    }
  }
}
