import { useState } from 'react'
import './App.css'
import {
  analyzeImageFile,
  convertImageToRgbaPng,
  downloadBytes,
  formatBytes,
  type AnalyzedImage,
  type ConversionResult,
} from './features/image-converter/index.ts'
import { ConversionPanel } from './features/image-converter/components/ConversionPanel'
import { DropZone } from './features/image-converter/components/DropZone'
import { StatusBanner } from './features/image-converter/components/StatusBanner'

type AppState = {
  file: File
  analysis: AnalyzedImage
  bytes: Uint8Array
}

function App() {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [status, setStatus] = useState<ConversionResult | null>(null)
  const [dragWarning, setDragWarning] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  async function loadFile(fileList: FileList | File[]) {
    const [file, ...rest] = Array.from(fileList)

    if (!file) {
      return
    }

    // 複数ファイルを同時に抱えると、単一出力前提の画面で「何が変換対象か」が曖昧になるため、
    // 今回は先頭のみを受け付けて明示的に警告する。
    setDragWarning(
      rest.length > 0
        ? `複数ファイルが検出されました。先頭の ${file.name} のみを処理します。`
        : null,
    )
    setStatus(null)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const analysis = await analyzeImageFile(file, bytes)
    setAppState({ file, analysis, bytes })
  }

  async function handleConvert() {
    if (!appState || !appState.analysis.canConvert || isConverting) {
      return
    }

    setIsConverting(true)
    setStatus({
      kind: 'info',
      message: '変換中です。PNGはチャンク単位で再構成し、JPEGはPNGへ描き出します。',
    })

    try {
      const result = await convertImageToRgbaPng(
        appState.file,
        appState.bytes,
        appState.analysis,
      )

      downloadBytes(result.bytes, result.filename, 'image/png')

      setStatus({
        kind: 'success',
        message: `${result.filename} を保存しました。出力サイズ: ${formatBytes(result.bytes.length)}`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '不明なエラーが発生しました。'

      setStatus({
        kind: 'error',
        message: `変換に失敗しました: ${message}`,
      })
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true" />

      <section className="hero-panel">
        <p className="hero-panel__eyebrow">RGB to RGBA / browser-only</p>
        <h1>RGB24/48 を RGBA32/64 の PNG に変換</h1>
        <p className="hero-panel__lead">
          PNG は canvas を経由せず、チャンクとスキャンラインをそのまま扱って
          <strong> bit depth と iCCP を保持</strong>します。JPEG はアルファを持てないため、
          不透明アルファ付き PNG として書き出します。
        </p>

        <div className="hero-panel__flow" aria-label="操作の流れ">
          <span>1. 画像をドロップ</span>
          <span>2. 解析結果を確認</span>
          <span>3. RGBA PNG を保存</span>
        </div>
      </section>

      <DropZone
        onSelectFiles={loadFile}
        disabled={isConverting}
        hint="PNG (RGB/RGBA, 8/16bit) / JPEG"
      />

      <StatusBanner message={dragWarning} tone="warning" />
      <StatusBanner message={status?.message ?? null} tone={status?.kind ?? 'info'} />

      <ConversionPanel
        file={appState?.file ?? null}
        analysis={appState?.analysis ?? null}
        isConverting={isConverting}
        onConvert={handleConvert}
      />
    </main>
  )
}

export default App
