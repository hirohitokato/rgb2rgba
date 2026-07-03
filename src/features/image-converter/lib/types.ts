export type StatusTone = 'info' | 'success' | 'warning' | 'error'

export type AnalysisStatus = 'ready' | 'already-rgba' | 'unsupported' | 'error'

type BaseAnalysis = {
  fileName: string
  fileSize: number
  hasAlpha: boolean
  hasICC: boolean
  status: AnalysisStatus
  canConvert: boolean
  summary: string
  details: string[]
  warnings: string[]
  outputSummary: string
}

export type PngColorType = 0 | 2 | 3 | 4 | 6

export type PngChunk = {
  type: string
  data: Uint8Array
}

export type PngAnalysis = BaseAnalysis & {
  kind: 'png'
  width: number
  height: number
  bitDepth: number
  colorType: PngColorType | number
  colorTypeName: string
  interlace: number
  chunks: PngChunk[]
}

export type JpegAnalysis = BaseAnalysis & {
  kind: 'jpeg'
  width: number
  height: number
  bitDepth: number
  components: number
  colorModel: string
  isProgressive: boolean
}

export type ErrorAnalysis = BaseAnalysis & {
  kind: 'unknown'
  width: null
  height: null
  bitDepth: null
}

export type AnalyzedImage = PngAnalysis | JpegAnalysis | ErrorAnalysis

export type ConversionOutput = {
  bytes: Uint8Array
  filename: string
}

export type ConversionResult = {
  kind: StatusTone
  message: string
}
