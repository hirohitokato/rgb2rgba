import type { StatusTone } from '../lib/types.ts'

type StatusBannerProps = {
  message: string | null
  tone: StatusTone
}

export function StatusBanner({ message, tone }: StatusBannerProps) {
  if (!message) {
    return null
  }

  return (
    <p className={`status-banner status-banner--${tone}`} role="status" aria-live="polite">
      {message}
    </p>
  )
}
