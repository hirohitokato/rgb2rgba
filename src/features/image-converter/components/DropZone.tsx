import { useRef } from 'react'

type DropZoneProps = {
  disabled: boolean
  hint: string
  onSelectFiles: (files: FileList | File[]) => void | Promise<void>
}

export function DropZone({ disabled, hint, onSelectFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <section className="theme-surface-section">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
        onChange={(event) => {
          if (event.target.files) {
            void onSelectFiles(event.target.files)
          }

          // 同一ファイルの再選択でも change を発火させるため、読み取り後にリセットする。
          event.currentTarget.value = ''
        }}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="theme-text-main m-0 text-[1rem]">画像を選択して変換を開始</p>
          <p className="theme-text-dim mt-2 text-[0.9rem] leading-7">
            ボタンからファイルを選ぶか、画像を画面内にドロップしてください。
          </p>
          <p className="theme-text-dim mt-1 text-[0.85rem]">{hint}</p>
        </div>

        <button
          type="button"
          className="theme-primary-button shrink-0"
          disabled={disabled}
          onClick={() => {
            inputRef.current?.click()
          }}
        >
          ファイルを選択する
        </button>
      </div>
    </section>
  )
}
