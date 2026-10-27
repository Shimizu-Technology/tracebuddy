/** Keep a view-shot tmpfile alive until Photos finishes, including rejected saves. */
export async function saveTemporaryCapture(
  capture: () => Promise<string>,
  save: (uri: string) => Promise<void>,
  release: (uri: string) => void,
) {
  let uri: string | null = null
  try {
    uri = await capture()
    await save(uri)
  } finally {
    if (uri) release(uri)
  }
}
