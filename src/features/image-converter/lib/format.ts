export function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

export function formatDimension(width: number | null, height: number | null) {
  if (!width || !height) {
    return '未取得'
  }

  return `${width} × ${height}`
}

export function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '')
}
