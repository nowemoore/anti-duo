import { useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import type { Unit } from '@shared/types'
import { useLanguage } from '../context/LanguageContext'
import { useScreenHeader } from '../context/HeaderContext'
import { LearnCard } from './LearnPhase'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * Browse detail: a Learn-style info card and — for languages with a draw capability (JA) — a swipeable
 * write-practice canvas. A top Info/Write segment mirrors the swipe and lets you switch back off the
 * canvas page (whose drawing surface captures horizontal drags, so you can't swipe away from it).
 */
export function BrowseDetail({ unit, onBack }: { unit: Unit; onBack: () => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const pack = useLanguage()
  const Practice = pack.draw?.Practice
  const scrollRef = useRef<ScrollView>(null)
  // Pages inside a horizontal ScrollView need an explicit size — otherwise flex:1 children (the canvas)
  // collapse to zero height. We measure the pager's viewport and stamp each page with it.
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [page, setPage] = useState(0)

  useScreenHeader(onBack)

  // No write page (e.g. Arabic): just the info card.
  if (!Practice) {
    return (
      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.cardScroll}>
          <LearnCard unit={unit} />
        </ScrollView>
      </View>
    )
  }

  const goTo = (p: number) => {
    setPage(p)
    scrollRef.current?.scrollTo({ x: p * size.w, animated: true })
  }
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.w) setPage(Math.round(e.nativeEvent.contentOffset.x / size.w))
  }
  const pageStyle = { width: size.w, height: size.h }

  return (
    <View style={styles.panel}>
      <View style={styles.tabs}>
        {['Info', 'Write'].map((label, i) => (
          <Pressable key={label} style={[styles.tab, page === i && styles.tabOn]} onPress={() => goTo(i)}>
            <Text style={[styles.tabText, page === i && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View
        style={styles.pager}
        onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        {size.w > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
          >
            <View style={pageStyle}>
              <ScrollView contentContainerStyle={styles.cardScroll}>
                <LearnCard unit={unit} />
              </ScrollView>
            </View>
            <View style={pageStyle}>
              <Practice unit={unit} />
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  cardScroll: { flexGrow: 1 },
  tabs: { flexDirection: 'row', alignSelf: 'center', gap: 2, padding: 3, backgroundColor: colors.bg, borderRadius: radius.pill, marginBottom: spacing.md },
  tab: { paddingVertical: 6, paddingHorizontal: 22, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13 },
  tabTextOn: { color: colors.onAccent },
  pager: { flex: 1 },
})
