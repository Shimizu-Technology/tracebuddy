import { useEffect, useRef, useState } from 'react'
import { Alert, PixelRatio, StyleSheet, View } from 'react-native'
import { captureRef, releaseCapture } from 'react-native-view-shot'

import { captureImageKeys, capturePixelWidth, createCaptureReadiness, saveTemporaryCapture } from '../../../captureUtils'
import { documentCapture } from '../../../nativeSafetyModel'
import type { SavedPracticeSession } from '../../../practiceStorageModel'
import { lineForSource } from '../../data/catalog'
import { requestDrawingPhotoExport, saveToLibraryAsync } from '../../data/drawingPhotos'
import { readPictureLine } from '../../data/usePictureLine'
import { DrawingDocument } from './DrawingDocument'
import { createInkExport } from './createInkExport'

type Capture = {
  session: SavedPracticeSession
  guideSvg: string
  inkUri?: string
  readiness: ReturnType<typeof createCaptureReadiness>
}

export function usePhotoExport() {
  const [capture, setCapture] = useState<Capture | null>(null)
  const [saving, setSaving] = useState(false)
  const node = useRef<View>(null)
  const pending = useRef(false)
  const active = useRef(true)
  const cleanup = useRef<(() => void) | null>(null)

  useEffect(() => {
    active.current = true
    return () => { active.current = false; cleanup.current?.() }
  }, [])

  async function saveToPhotos(session: SavedPracticeSession) {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    let ink: ReturnType<typeof createInkExport>
    try {
      if (!await requestDrawingPhotoExport() || !active.current) return
      const guide = await readPictureLine(lineForSource(session.source))
      if (guide.status === 'error') throw guide.error
      if (!active.current) return
      // Capture a second, unzoomed square. The on-screen Metal view is
      // replaced with a decoded transparent ink image for native view-shot.
      ink = createInkExport(session.strokes, capturePixelWidth(documentCapture.width, PixelRatio.get()))
      const inkUri = ink?.uri
      const keys = captureImageKeys(session.source.uploadedImage?.uri, false, session.stickers)
      const readiness = createCaptureReadiness(inkUri ? [...keys, 'ink'] : keys)
      cleanup.current = readiness.dispose
      setCapture({ session, guideSvg: guide.xml, inkUri, readiness })
      await readiness.ready
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      if (!node.current || !active.current) return
      await saveTemporaryCapture(
        () => captureRef(node, {
          width: documentCapture.width, height: documentCapture.height,
          format: 'png', quality: 1, result: 'tmpfile', useRenderInContext: true,
        }),
        async (uri) => { if (active.current) await saveToLibraryAsync(uri) },
        releaseCapture,
      )
      if (active.current) Alert.alert('Saved to Photos', 'Your drawing is ready in Photos.')
    } catch {
      if (active.current) Alert.alert('Could not save to Photos', 'Your drawing is kept in My drawings. Try saving it again.')
    } finally {
      cleanup.current?.()
      cleanup.current = null
      ink?.release()
      pending.current = false
      if (active.current) {
        setCapture(null)
        setSaving(false)
      }
    }
  }

  const captureView = capture && (
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View ref={node} collapsable={false}>
        <DrawingDocument side={documentCapture.side} session={capture.session} guideSvg={capture.guideSvg} inkUri={capture.inkUri}
          onImageLoad={capture.readiness.loaded} onImageError={capture.readiness.failed} />
      </View>
    </View>
  )

  return { saveToPhotos, saving, captureView }
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, left: -documentCapture.side - 16 },
})
