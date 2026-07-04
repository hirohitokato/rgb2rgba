import { formatBytes, formatDimension } from '../lib/format.ts'
import type { AnalyzedImage } from '../lib/types.ts'

type ConversionPanelProps = {
  file: File | null
  analysis: AnalyzedImage | null
  previewUrl: string | null
  isConverting: boolean
  hasConvertedOutput: boolean
  onPrimaryAction: () => void | Promise<void>
}

export function ConversionPanel({
  file,
  analysis,
  previewUrl,
  isConverting,
  hasConvertedOutput,
  onPrimaryAction,
}: ConversionPanelProps) {
  if (!file || !analysis) {
    return null
  }

  const profileLabel =
    analysis.kind === 'png'
      ? analysis.hasICC
        ? 'iCCP を保持'
        : '埋め込みプロファイルなし'
      : analysis.kind === 'jpeg'
        ? '再埋め込みなし'
        : '該当なし'

  const actionLabel = hasConvertedOutput
    ? '変換した画像をダウンロードする'
    : isConverting
      ? '変換中…'
      : analysis.kind === 'png'
        ? `RGB${analysis.bitDepth === 16 ? '48' : '24'} PNG を RGBA${
            analysis.bitDepth === 16 ? '64' : '32'
          } PNG に変換する`
        : analysis.kind === 'jpeg'
          ? 'JPEG を RGBA32 PNG に変換する'
          : '変換できません'

  return (
    <section className="theme-surface-panel">
      <header className="grid gap-5 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
        <div className="theme-preview-frame">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${file.name} のプレビュー`}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="theme-text-dim text-[0.85rem]">プレビューなし</span>
          )}
        </div>

        <div className="min-w-0">
          <p className="theme-label">入力ファイル</p>
          <h2 className="theme-display-subtitle m-0 break-words text-[1.24rem] leading-[1.35]">
            {file.name}
          </h2>
          <div className="theme-text-dim mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[0.92rem]">
            <p className="m-0">{formatBytes(file.size)}</p>
            <p className="m-0">{formatDimension(analysis.width, analysis.height)}</p>
            <p className="m-0">
              {analysis.kind === 'png' ? 'PNG' : analysis.kind === 'jpeg' ? 'JPEG' : 'Unknown'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="theme-card">
          <p className="theme-label">解析結果</p>
          <dl className="m-0 grid gap-3">
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-[14px]">
              <dt className="theme-text-dim">形式</dt>
              <dd className="theme-text-main m-0">
                {analysis.kind === 'png'
                  ? 'PNG'
                  : analysis.kind === 'jpeg'
                    ? 'JPEG'
                    : 'Unknown'}
              </dd>
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-[14px]">
              <dt className="theme-text-dim">サイズ</dt>
              <dd className="theme-text-main m-0">{formatDimension(analysis.width, analysis.height)}</dd>
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-[14px]">
              <dt className="theme-text-dim">ビット深度</dt>
              <dd className="theme-text-main m-0">
                {analysis.bitDepth ? `${analysis.bitDepth}bit / channel` : '未取得'}
              </dd>
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-[14px]">
              <dt className="theme-text-dim">アルファ</dt>
              <dd className="theme-text-main m-0">{analysis.hasAlpha ? 'あり' : 'なし'}</dd>
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-[14px]">
              <dt className="theme-text-dim">ICC / iCCP</dt>
              <dd className="theme-text-main m-0">{analysis.hasICC ? 'あり' : 'なし'}</dd>
            </div>
            <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-[14px]">
              <dt className="theme-text-dim">出力</dt>
              <dd className="theme-text-main m-0">{analysis.outputSummary}</dd>
            </div>
          </dl>
        </article>

        <article className="theme-card">
          <p className="theme-label">出力ポリシー</p>
          <ul className="theme-text-dim m-0 pl-[18px] leading-[1.8]">
            <li>{analysis.summary}</li>
            <li>カラープロファイル: {profileLabel}</li>
            {analysis.details.map((detail) => (
              <li key={detail} className="mt-1.5">
                {detail}
              </li>
            ))}
          </ul>
        </article>
      </div>

      {analysis.warnings.length > 0 ? (
        <article className="theme-card">
          <p className="theme-label">注意事項</p>
          <ul className="theme-text-dim m-0 pl-[18px] leading-[1.8]">
            {analysis.warnings.map((warning) => (
              <li key={warning} className="mt-1.5 first:mt-0">
                {warning}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <footer className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          className="theme-primary-button"
          disabled={!analysis.canConvert || isConverting}
          onClick={() => {
            void onPrimaryAction()
          }}
        >
          {actionLabel}
        </button>
      </footer>
    </section>
  )
}
