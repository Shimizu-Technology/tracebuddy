// Release captures that complete after a drawing/preset change or unmount.
export async function prepareARGuide({ capture, isCurrent, release }: {
  capture: () => Promise<string>
  isCurrent: () => boolean
  release: (uri: string) => void
}) {
  const uri = await capture()
  if (!isCurrent()) {
    release(uri)
    return null
  }
  return uri
}
