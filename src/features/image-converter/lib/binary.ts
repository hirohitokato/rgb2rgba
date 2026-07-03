export async function inflateZlib(bytes: Uint8Array) {
  return transformCompression(bytes, 'deflate', 'decompress')
}

export async function deflateZlib(bytes: Uint8Array) {
  return transformCompression(bytes, 'deflate', 'compress')
}

async function transformCompression(
  bytes: Uint8Array,
  format: CompressionFormat,
  mode: 'compress' | 'decompress',
) {
  const stream =
    mode === 'compress'
      ? new CompressionStream(format)
      : new DecompressionStream(format)

  const writer = stream.writable.getWriter()
  const response = new Response(stream.readable)
  const writeTask = (async () => {
    await writer.write(cloneAsUint8Array(bytes))
    await writer.close()
  })()
  const readTask = response.arrayBuffer()
  const [buffer] = await Promise.all([readTask, writeTask])

  return new Uint8Array(buffer)
}

function cloneAsUint8Array(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}
