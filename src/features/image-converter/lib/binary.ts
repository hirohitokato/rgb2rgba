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
  await writer.write(cloneAsUint8Array(bytes))
  await writer.close()

  const response = new Response(stream.readable)
  return new Uint8Array(await response.arrayBuffer())
}

function cloneAsUint8Array(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy
}
