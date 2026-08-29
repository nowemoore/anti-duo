import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { StatusBar } from 'expo-status-bar'
import { setAudioModeAsync } from 'expo-audio'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope'
import { Fraunces_400Regular, Fraunces_700Bold } from '@expo-google-fonts/fraunces'
/*
 * Japanese faces, imported from their per-weight entry points rather than the package barrel.
 *
 * These carry the full kana + kanji range, so each weight is 5-8 MB against a Latin face's kilobytes.
 * The barrel `require`s every weight it ships, which bundled all five Zen Old Mincho cuts (27 MB) for
 * the one we actually use.
 */
import { YujiSyuku_400Regular } from '@expo-google-fonts/yuji-syuku/400Regular'
import { ShipporiMincho_400Regular } from '@expo-google-fonts/shippori-mincho/400Regular'
import { KleeOne_400Regular } from '@expo-google-fonts/klee-one/400Regular'
import './src/icons' // registers the FontAwesome library (side effect)
import { setupPwa } from './src/web/pwa'
import { LanguageProvider, useLanguage } from './src/context/LanguageContext'
import { ContentProvider } from './src/context/ContentContext'
import { ProgressProvider } from './src/context/ProgressContext'
import { AuthProvider } from './src/context/AuthContext'
import { SyncProvider } from './src/context/SyncContext'
import { ScrollLockContext } from './src/context/ScrollLockContext'
import { TabBarContext } from './src/context/TabBarContext'
import { OverlayProvider } from './src/components/Overlay'
import { StudyView } from './src/views/StudyView'
import { StatsView } from './src/views/StatsView'
import { SettingsView } from './src/views/SettingsView'
import { FadeView } from './src/components/FadeView'
import { GlassSurface } from './src/components/Glass'
import { Icon } from './src/components/Icon'
import { edge, fonts, radius, spacing, type Palette } from './src/theme'
import { useColors, useStyles } from './src/hooks/theme'

type Tab = 'study' | 'stats' | 'settings'

const TABS: { key: Tab; icon: IconName; label: string }[] = [
  { key: 'study', icon: 'graduation-cap', label: 'Study' },
  { key: 'stats', icon: 'chart-column', label: 'Stats' },
  { key: 'settings', icon: 'gear', label: 'Settings' },
]

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Fraunces_400Regular,
    Fraunces_700Bold,
    YujiSyuku_400Regular,
    ShipporiMincho_400Regular,
    KleeOne_400Regular,
  })

  // Play pronunciations through the speaker even when the iOS Ring/Silent switch is on.
  // Native-only: expo-audio's audio session doesn't apply on web (TTS goes through the browser).
  useEffect(() => {
    if (Platform.OS === 'web') setupPwa()
    else setAudioModeAsync({ playsInSilentMode: true }).catch(() => {})
  }, [])

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ContentProvider>
          <ProgressProvider>
            <AuthProvider>
              <SyncProvider>
                <OverlayProvider>
                  <Shell />
                </OverlayProvider>
              </SyncProvider>
            </AuthProvider>
          </ProgressProvider>
        </ContentProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}

function Shell() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('study')
  const [scrollLocked, setScrollLocked] = useState(false)
  /** Height of the floating tab bar, so the content behind it can end above it. */
  const [barH, setBarH] = useState(0)
  const onStudy = tab === 'study'

  // Crossfade the UI when the language (theme + content) switches, so it isn't a hard cut. The bg
  // (a solid colour behind everything) swaps instantly; the content fades back in over it.
  const lang = useLanguage().id
  const fade = useRef(new Animated.Value(1)).current
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    fade.setValue(0.2)
    Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }).start()
  }, [lang, fade])

  return (
    <ScrollLockContext.Provider value={setScrollLocked}>
    <TabBarContext.Provider value={barH}>
    <View style={styles.app}>
      <StatusBar style="light" />
      <Animated.View style={[styles.fill, { opacity: fade }]}>
      {/* Soft color pools behind the frosted panels so the "glass" has something to reveal. */}
      <Glows />
      {/* Study owns its own chrome now: it runs a native stack, whose system bar carries the back
          control, the help button and — under it — the step title and dots. Stats and Settings have
          no bar of their own, so they just need the status-bar inset. */}
      {!onStudy && <View style={{ paddingTop: insets.top + 4 }} />}
      {/* Study stays mounted (just hidden) while you're on another tab, so an in-progress practice/learn
          session keeps its exact place — hop to Stats/Settings and come back to the same question.
          That includes the navigation stack: the screen you were on is still on it when you return. */}
      {/* Full height: screens decide for themselves whether to end above the bar or run under it. */}
      <View style={[styles.studyBody, !onStudy && styles.hidden]}>
        <StudyView />
      </View>
      {!onStudy && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: barH + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!scrollLocked}
        >
          <FadeView key={tab}>{tab === 'stats' ? <StatsView /> : <SettingsView />}</FadeView>
        </ScrollView>
      )}
      {/*
        A floating bar rather than a full-width strip, and real glass rather than a painted fill.
        Overlaid on the content rather than sitting in the column below it — in flow it reserved a
        band of bare background for itself, which is the grey stripe that gave it away as not being
        system chrome. Content clears it via `barH`, measured here rather than guessed.
      */}
      <View
        style={[styles.tabbarWrap, { paddingBottom: insets.bottom + spacing.sm }]}
        onLayout={(e) => setBarH(e.nativeEvent.layout.height)}
      >
        <GlassSurface tint={colors.panelStrong} style={styles.tabbar}>
          {TABS.map((t) => {
            const active = t.key === tab
            return (
              <Pressable
                key={t.key}
                style={[styles.tab, active && styles.tabOn]}
                onPress={() => setTab(t.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
              >
                <Icon name={t.icon} size={20} color={active ? colors.highlightInk : colors.muted} />
                <Text style={[styles.tabLabel, !active && styles.tabLabelOff]}>{t.label}</Text>
              </Pressable>
            )
          })}
        </GlassSurface>
      </View>
      </Animated.View>
    </View>
    </TabBarContext.Provider>
    </ScrollLockContext.Provider>
  )
}

/**
 * Splits an `rgba(r,g,b,a)` string into an SVG-friendly colour and a numeric opacity.
 *
 * The palette stores glows as rgba because they were plain View fills; SVG gradient stops want the
 * two apart. Anything unparseable falls back to full opacity rather than vanishing.
 */
function rgbaParts(value: string): { color: string; opacity: number } {
  const m = value.match(/rgba?\(([^)]+)\)/)
  if (!m) return { color: value, opacity: 1 }
  const parts = m[1].split(',').map((n) => n.trim())
  const alpha = parts.length > 3 ? Number(parts[3]) : 1
  return {
    color: `rgb(${parts.slice(0, 3).join(',')})`,
    opacity: Number.isFinite(alpha) ? alpha : 1,
  }
}

/**
 * The two colour pools behind the frosted panels.
 *
 * Radial gradients rather than plain circles: glassmorphism needs the light to fall off, and a flat
 * fill reads as a hard-edged disc with a visible rim. React Native has no CSS `filter: blur`, so the
 * gradient *is* the blur — same soft pool, no native blur view, and react-native-svg is already a
 * dependency. Colours come from the active palette, so Arabic's gold/green pools work unchanged.
 *
 * Centres match the old absolute offsets: A bleeds off the top-left, B off the bottom-right.
 */
function Glows() {
  const colors = useColors()
  const { width, height } = useWindowDimensions()
  const a = rgbaParts(colors.glow1)
  const b = rgbaParts(colors.glow2)
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={width} height={height}>
      <Defs>
        <RadialGradient id="glowA" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={a.color} stopOpacity={a.opacity} />
          <Stop offset="1" stopColor={a.color} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowB" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
          <Stop offset="1" stopColor={b.color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={90} cy={50} r={230} fill="url(#glowA)" />
      <Circle cx={width - 60} cy={height - 100} r={220} fill="url(#glowB)" />
    </Svg>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  // No padding: the stack's system bar has to reach the screen edges. Screens inset themselves.
  studyBody: { flex: 1 },
  hidden: { display: 'none' },
  fill: { flex: 1 },
  // The wrapper carries the home-indicator inset; the bar itself floats clear of the screen edges.
  tabbarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  /*
   * A true capsule, not a rounded rectangle: the radius is half the bar's own height, so the ends
   * are semicircles and the shape reads as one floating object. `radius.lg` left visible straight
   * runs at the sides, which made it look like a panel that happened to be tucked up off the floor.
   */
  tabbar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: edge,
    borderRadius: radius.pill,
    padding: spacing.sm,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.pill,
  },
  // The selected tab is a filled pill; the rest are bare glyphs on the bar.
  /* Lavender, like the progress bars: which tab you are on is a statement of where you
     are, not an invitation. The accent stays with the things you can press. */
  tabOn: { backgroundColor: colors.highlightWash },
  tabLabel: { color: colors.highlightInk, fontFamily: fonts.semibold, fontSize: 13 },
  tabLabelOff: { color: colors.muted },
})
