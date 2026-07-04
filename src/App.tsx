import { useEffect, useRef, useState } from 'react'
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
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const dragDepthRef = useRef(0)
  const previewUrlRef = useRef<string | null>(null)

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

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    previewUrlRef.current = nextPreviewUrl
    setPreviewUrl(nextPreviewUrl)

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

  useEffect(() => {
    function hasFiles(event: DragEvent) {
      return Array.from(event.dataTransfer?.types ?? []).includes('Files')
    }

    function handleWindowDragEnter(event: DragEvent) {
      if (isConverting || !hasFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current += 1
      setIsDraggingFiles(true)
    }

    function handleWindowDragOver(event: DragEvent) {
      if (isConverting || !hasFiles(event)) {
        return
      }

      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
      setIsDraggingFiles(true)
    }

    function handleWindowDragLeave(event: DragEvent) {
      if (isConverting || !hasFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

      if (dragDepthRef.current === 0) {
        setIsDraggingFiles(false)
      }
    }

    function handleWindowDrop(event: DragEvent) {
      if (!hasFiles(event)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current = 0
      setIsDraggingFiles(false)

      if (isConverting || !event.dataTransfer?.files.length) {
        return
      }

      void loadFile(event.dataTransfer.files)
    }

    window.addEventListener('dragenter', handleWindowDragEnter)
    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter)
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDrop)
      dragDepthRef.current = 0
    }
  }, [isConverting])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  return (
    <main className="theme-app-shell">
      {isDraggingFiles ? (
        <div className="theme-drop-overlay">
          <div className="theme-drop-frame">
            <div className="px-8 text-center">
              <p className="theme-display-eyebrow">Drop anywhere</p>
              <p className="theme-display-subtitle mt-4 text-[clamp(1.8rem,4vw,2.7rem)] leading-[1.05]">
                画像をドロップ
              </p>
              <p className="theme-text-soft mt-4 text-[0.96rem] leading-7">
                ドラッグしている画像をドロップして読み込んでください。
              </p>
              <p className="theme-text-dim mt-2 text-[0.88rem]">
                PNG (RGB/RGBA, 8/16bit) / JPEG
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="theme-app-backdrop" aria-hidden="true" />

      <section className="theme-surface-hero">
        <p className="theme-display-eyebrow">RGB to RGBA / browser-only</p>
        <h1 className="theme-display-title">
          RGB to RGBA Converter
        </h1>
        <div className="theme-surface-hero-subtle">
          <p className="theme-text-soft m-0 w-full text-[0.98rem] leading-8">
            PNG/JPG画像をRGBA形式のPNGに変換します。PNG画像の場合はiCCPを保持し、JPGはsRGBへ変換後にPNG画像に変換します。<br/>
            ※フロントエンドのみで動作し、サーバーに画像を送信することはありません。
          </p>
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
        previewUrl={previewUrl}
        isConverting={isConverting}
        hasConvertedOutput={preparedDownload !== null}
        onPrimaryAction={handlePrimaryAction}
      />
    </main>
  )
}

export default App
