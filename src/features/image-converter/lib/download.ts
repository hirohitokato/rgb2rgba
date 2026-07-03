export function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([cloneAsArrayBuffer(bytes)], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  // URL の revoke が早すぎると一部ブラウザでダウンロード開始前に失効するため、
  // 短い猶予を置いてから破棄する。
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function cloneAsArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
