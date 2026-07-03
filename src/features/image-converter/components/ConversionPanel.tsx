import { formatBytes, formatDimension } from '../lib/format.ts'
import type { AnalyzedImage } from '../lib/types.ts'

type ConversionPanelProps = {
  file: File | null
  analysis: AnalyzedImage | null
  isConverting: boolean
  hasConvertedOutput: boolean
  onPrimaryAction: () => void | Promise<void>
}

export function ConversionPanel({
  file,
  analysis,
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
    <section className="conversion-panel">
      <header className="conversion-panel__header">
        <div>
          <p className="conversion-panel__label">入力ファイル</p>
          <h2>{file.name}</h2>
        </div>
        <p className="conversion-panel__filesize">{formatBytes(file.size)}</p>
      </header>

      <div className="conversion-panel__grid">
        <article className="info-card">
          <p className="info-card__title">解析結果</p>
          <dl className="info-list">
            <div>
              <dt>形式</dt>
              <dd>
                {analysis.kind === 'png'
                  ? 'PNG'
                  : analysis.kind === 'jpeg'
                    ? 'JPEG'
                    : 'Unknown'}
              </dd>
            </div>
            <div>
              <dt>サイズ</dt>
              <dd>{formatDimension(analysis.width, analysis.height)}</dd>
            </div>
            <div>
              <dt>ビット深度</dt>
              <dd>{analysis.bitDepth ? `${analysis.bitDepth}bit / channel` : '未取得'}</dd>
            </div>
            <div>
              <dt>アルファ</dt>
              <dd>{analysis.hasAlpha ? 'あり' : 'なし'}</dd>
            </div>
            <div>
              <dt>ICC / iCCP</dt>
              <dd>{analysis.hasICC ? 'あり' : 'なし'}</dd>
            </div>
            <div>
              <dt>出力</dt>
              <dd>{analysis.outputSummary}</dd>
            </div>
          </dl>
        </article>

        <article className="info-card">
          <p className="info-card__title">出力ポリシー</p>
          <ul className="policy-list">
            <li>{analysis.summary}</li>
            <li>カラープロファイル: {profileLabel}</li>
            {analysis.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </article>
      </div>

      {analysis.warnings.length > 0 ? (
        <article className="note-card">
          <p className="note-card__title">注意事項</p>
          <ul className="note-card__list">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </article>
      ) : null}

      <footer className="conversion-panel__footer">
        <button
          type="button"
          className="primary-action"
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
