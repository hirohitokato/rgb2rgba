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

type PreparedDownload = {
  bytes: Uint8Array
  filename: string
  mimeType: string
}

function App() {
  const [appState, setAppState] = useState<AppState | null>(null)
  const [status, setStatus] = useState<ConversionResult | null>(null)
  const [dragWarning, setDragWarning] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [preparedDownload, setPreparedDownload] = useState<PreparedDownload | null>(null)

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
    setPreparedDownload(null)

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

      setPreparedDownload({
        bytes: result.bytes,
        filename: result.filename,
        mimeType: 'image/png',
      })

      setStatus({
        kind: 'success',
        message: `${result.filename} の変換が完了しました。出力サイズ: ${formatBytes(
          result.bytes.length,
        )}。ダウンロードボタンから保存できます。`,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '不明なエラーが発生しました。'

      setPreparedDownload(null)
      setStatus({
        kind: 'error',
        message: `変換に失敗しました: ${message}`,
      })
    } finally {
      setIsConverting(false)
    }
  }

  function handleDownload() {
    if (!preparedDownload) {
      return
    }

    downloadBytes(
      preparedDownload.bytes,
      preparedDownload.filename,
      preparedDownload.mimeType,
    )

    setStatus({
      kind: 'success',
      message: `${preparedDownload.filename} をダウンロードしました。`,
    })
  }

  function handlePrimaryAction() {
    if (preparedDownload) {
      handleDownload()
      return
    }

    void handleConvert()
  }

  return (
    <main className="app-shell">
      <div className="app-shell__backdrop" aria-hidden="true" />

      <section className="hero-panel">
        <p className="hero-panel__eyebrow">RGB to RGBA / browser-only</p>
        <h1>RGB to RGBA Converter</h1>
        <p className="hero-panel__lead">
          指定したPNG/JPG画像をRGBA形式に変換し、アルファ付きPNGとして保存します。
         PNG画像はiCCPを保持し、JPGはsRGBに変換したRGBA PNG画像に変換して書き出します。
        </p>
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
        hasConvertedOutput={preparedDownload !== null}
        onPrimaryAction={handlePrimaryAction}
      />
    </main>
  )
}

export default App
