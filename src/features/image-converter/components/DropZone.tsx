import { useRef, useState } from 'react'

type DropZoneProps = {
  disabled: boolean
  hint: string
  onSelectFiles: (files: FileList | File[]) => void | Promise<void>
}

export function DropZone({ disabled, hint, onSelectFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  return (
    <section
      className={`drop-zone${isDragging ? ' drop-zone--active' : ''}${
        disabled ? ' drop-zone--disabled' : ''
      }`}
      onClick={() => {
        if (!disabled) {
          inputRef.current?.click()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) {
          setIsDragging(true)
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)

        if (!disabled) {
          void onSelectFiles(event.dataTransfer.files)
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          inputRef.current?.click()
        }
      }}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        className="drop-zone__input"
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

      <p className="drop-zone__title">ここに画像をドロップ、またはクリックして選択</p>
      <p className="drop-zone__hint">{hint}</p>
    </section>
  )
}
