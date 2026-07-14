import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { enabledUnitCount, isCategoryEnabled, isUnitEnabled, toggleInList } from '@lib/categories'
import { Toggle } from './Toggle'
import { Icon } from './Icon'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/** Settings section: pick which units to study by toggling categories or individual units. */
export function CategorySettings() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress, update } = useProgress()
  const { ui } = useLanguage()
  const settings = progress.settings
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleCategory = (name: string) =>
    update((p) => {
      const disabledCategories = toggleInList(p.settings.disabledCategories, name)
      const newSettings = { ...p.settings, disabledCategories }
      if (enabledUnitCount(index, newSettings) === 0) return p
      return { ...p, settings: newSettings }
    })

  const toggleUnit = (idx: number) =>
    update((p) => {
      const disabledUnits = toggleInList(p.settings.disabledUnits, idx)
      const newSettings = { ...p.settings, disabledUnits }
      if (enabledUnitCount(index, newSettings) === 0) return p
      return { ...p, settings: newSettings }
    })

  return (
    <View style={styles.panel}>
      <Text style={styles.h2}>Your learning</Text>
      <Text style={styles.muted}>Pick which {ui.noun} to study. Expand a category to fine-tune individual {ui.noun}.</Text>

      <View style={styles.list}>
        {index.categories.map((cat) => {
          const catOn = isCategoryEnabled(settings, cat.name)
          const isOpen = catOn && expanded.has(cat.name)
          const enabledInCat = cat.units.filter((k) => isUnitEnabled(settings, k)).length
          return (
            <View key={cat.name} style={styles.block}>
              <View style={styles.row}>
                <Pressable
                  onPress={() => catOn && toggleExpand(cat.name)}
                  disabled={!catOn}
                  style={styles.expand}
                  hitSlop={6}
                >
                  <Chevron open={isOpen} color={catOn ? colors.muted : colors.border} />
                </Pressable>
                <Text style={[styles.catName, !catOn && styles.off]}>{cat.name}</Text>
                <Text style={[styles.catCount, !catOn && styles.off]}>
                  {enabledInCat}/{cat.units.length}
                </Text>
                <Toggle checked={catOn} onChange={() => toggleCategory(cat.name)} label={cat.name} />
              </View>

              <Collapsible open={isOpen}>
                <View style={styles.unitGrid}>
                  {cat.units.map((k) => (
                    <View key={k.idx} style={styles.ckItem}>
                      <Text style={styles.ckChar}>{k.form}</Text>
                      <Text style={styles.ckGloss} numberOfLines={1}>
                        {k.gloss.join(', ')}
                      </Text>
                      <Toggle
                        small
                        checked={!settings.disabledUnits.includes(k.idx)}
                        onChange={() => toggleUnit(k.idx)}
                        label={k.form}
                      />
                    </View>
                  ))}
                </View>
              </Collapsible>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** A disclosure chevron that rotates from ▶ (closed) to ▼ (open). */
function Chevron({ open, color }: { open: boolean; color: string }) {
  const rot = useRef(new Animated.Value(open ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(rot, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [open, rot])
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] })
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Icon name="chevron-right" size={13} color={color} />
    </Animated.View>
  )
}

/**
 * Smoothly expands/collapses its children by animating height + opacity. The inner view is measured
 * out-of-flow (absolute) so the animated height is driven purely by the interpolation. Works on web
 * and native (LayoutAnimation is a no-op on react-native-web). Stays mounted after the first open so
 * the measured height is cached and later toggles animate cleanly.
 */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const styles = useStyles(makeStyles)
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current
  const [height, setHeight] = useState(0)
  const opened = useRef(open)
  if (open) opened.current = true

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 240,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [open, anim])

  if (!opened.current) return null
  return (
    <Animated.View
      style={{
        height: anim.interpolate({ inputRange: [0, 1], outputRange: [0, height] }),
        opacity: anim,
        overflow: 'hidden',
      }}
    >
      <View style={styles.collapseInner} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Animated.View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: { ...shadow, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  collapseInner: { position: 'absolute', left: 0, right: 0 },
  h2: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20, marginBottom: 6 },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.sm },
  list: { marginTop: 4 },
  block: { borderTopColor: colors.border, borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  expand: { width: 24, alignItems: 'center' },
  catName: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  catCount: { marginLeft: 'auto', color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  off: { color: colors.muted, opacity: 0.7 },
  unitGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 8, paddingLeft: 24 },
  ckItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  ckChar: { fontSize: 18, color: colors.ink, width: 26, textAlign: 'center' },
  ckGloss: { flex: 1, color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
})
