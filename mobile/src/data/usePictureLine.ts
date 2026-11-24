import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Asset } from 'expo-asset'
import { File } from 'expo-file-system'

import { createPictureLineCache } from './pictureLineModel'
import type { PictureLine, PictureLineState } from './pictureLineModel'

// Holds roughly a mounted gallery window. The native bundle and Expo's disk cache
// handle the file itself, while concurrent views share a single read into JS.
const cache = createPictureLineCache(async (moduleId) => {
  const asset = Asset.fromModule(moduleId)
  // Android Release resolves bundled assets to bare resource names, and expo-asset treats a sized
  // asset with no scheme as already downloaded. Reset it so the native module copies the file first.
  if (Platform.OS !== 'web' && !asset.uri.includes(':')) {
    asset.downloaded = false
    asset.localUri = null
  }
  const { localUri } = await asset.downloadAsync()
  if (!localUri) throw new Error('The line art asset is missing.')
  if (Platform.OS === 'web') {
    const response = await fetch(localUri)
    if (!response.ok) throw new Error('The line art asset could not be read.')
    return response.text()
  }
  return new File(localUri).text()
})

export const readPictureLine = cache.read

export function usePictureLine(picture: { line: PictureLine } | null | undefined, attempt = 0): PictureLineState {
  const line = picture?.line
  const [result, setResult] = useState<{ line: PictureLine; attempt: number; state: PictureLineState }>()

  useEffect(() => {
    if (line?.kind !== 'asset') return
    let active = true
    void readPictureLine(line).then((state) => {
      if (active) setResult({ line, attempt, state })
    })
    return () => { active = false }
  }, [attempt, line])

  // A route or tile can switch levels before its previous request settles.
  if (result && result.line === line && result.attempt === attempt) return result.state
  const xml = cache.peek(line)
  return xml === undefined ? { status: 'loading' } : { status: 'ready', xml }
}
