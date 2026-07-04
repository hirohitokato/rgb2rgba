import type { StatusTone } from '../lib/types.ts'

type StatusBannerProps = {
  message: string | null
  tone: StatusTone
}

export function StatusBanner({ message, tone }: StatusBannerProps) {
  if (!message) {
    return null
  }

  const toneClassName =
    tone === 'success'
      ? 'theme-status-success'
      : tone === 'warning'
        ? 'theme-status-warning'
        : tone === 'error'
          ? 'theme-status-error'
          : 'theme-status-info'

  return (
    <p
      className={`theme-status-banner ${toneClassName}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  )
}
