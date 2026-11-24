import { useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'

import { Button } from '../../ui/Button'
import { Text } from '../../ui/Text'
import { theme } from '../../ui/theme'
import { BottomCard } from './BottomCard'
import { TipArt } from './TipArt'
import type { TipId } from './TipArt'

const tips: { id: TipId; title: string; line: string }[] = [
  { id: 'stand', title: 'Steady stand', line: 'Prop it up so it can’t tip over.' },
  { id: 'page', title: 'Whole page', line: 'Raise it until you see the whole paper.' },
  { id: 'light', title: 'Good light', line: 'Even light. No big shadows on the page.' },
]

/** First-time setup tips. Swipe between them, or skip; they never block tracing. */
export function TipsCard({ reduceMotion, onClose }: { reduceMotion: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [pageWidth, setPageWidth] = useState(0)
  const scroller = useRef<ScrollView>(null)
  const last = index === tips.length - 1

  // When the card changes width (rotation, iPad), keep showing the same tip.
  const indexRef = useRef(index)
  useEffect(() => { indexRef.current = index }, [index])
  useEffect(() => {
    if (pageWidth > 0) scroller.current?.scrollTo({ x: indexRef.current * pageWidth, animated: false })
  }, [pageWidth])

  function goTo(next: number) {
    setIndex(next)
    scroller.current?.scrollTo({ x: next * pageWidth, animated: !reduceMotion })
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth > 0) setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth))
  }

  return (
    <BottomCard
      reduceMotion={reduceMotion}
      onDismiss={onClose}
      accessibilityLabel="Setup tips"
      footer={(
        <View style={styles.actions}>
          <Button label="Skip" variant="quiet" target="adult" onPress={onClose} style={styles.action} />
          <Button label={last ? 'Got it' : 'Next'} target="adult" onPress={() => (last ? onClose() : goTo(index + 1))} style={styles.action} />
        </View>
      )}
    >
      <View style={styles.dots} accessibilityLabel={`Tip ${index + 1} of ${tips.length}`} accessible>
        {tips.map((tip, dot) => <View key={tip.id} style={[styles.dot, dot === index && styles.dotOn]} />)}
      </View>
      <View onLayout={(event: LayoutChangeEvent) => setPageWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEnabled={pageWidth > 0}
        >
          {tips.map((tip) => (
            <View key={tip.id} style={[styles.tip, { width: pageWidth || undefined }]} accessible accessibilityLabel={`${tip.title}. ${tip.line}`}>
              <TipArt tip={tip.id} />
              <Text variant="heading" style={styles.center}>{tip.title}</Text>
              <Text tone="muted" style={styles.center}>{tip.line}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </BottomCard>
  )
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: theme.space.sm },
  dot: { width: theme.space.sm, height: theme.space.sm, borderRadius: theme.radius.full, backgroundColor: theme.colors.hairline },
  dotOn: { width: theme.space.xl, backgroundColor: theme.colors.ink },
  tip: { alignItems: 'center', gap: theme.space.sm, paddingHorizontal: theme.space.xs },
  center: { textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md },
  action: { flexGrow: 1 },
})
