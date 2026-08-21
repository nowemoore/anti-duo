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
import { ZenOldMincho_400Regular } from '@expo-google-fonts/zen-old-mincho/400Regular'
import './src/icons' // registers the FontAwesome library (side effect)
import { setupPwa } from './src/web/pwa'
import { LanguageProvider, useLanguage } from './src/context/LanguageContext'
import { ContentProvider } from './src/context/ContentContext'
import { ProgressProvider } from './src/context/ProgressContext'
import { HeaderProvider, useHeaderConfig } from './src/context/HeaderContext'
import { AuthProvider } from './src/context/AuthContext'
import { SyncProvider } from './src/context/SyncContext'
import { ScrollLockContext } from './src/context/ScrollLockContext'
import { OverlayProvider } from './src/components/Overlay'
import { StudyView } from './src/views/StudyView'
import { StatsView } from './src/views/StatsView'
import { SettingsView } from './src/views/SettingsView'
import { HelpButton } from './src/components/HelpButton'
import { BackButton } from './src/components/BackButton'
import { Bilingual } from './src/components/Bilingual'
import { FadeView } from './src/components/FadeView'
import { Icon } from './src/components/Icon'
import { fonts, spacing, type Palette } from './src/theme'
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
    ZenOldMincho_400Regular,
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
                  <HeaderProvider>
                    <Shell />
                  </HeaderProvider>
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
  const header = useHeaderConfig()
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
    <View style={styles.app}>
      <StatusBar style="light" />
      <Animated.View style={[styles.fill, { opacity: fade }]}>
      {/* Soft color pools behind the frosted panels so the "glass" has something to reveal. */}
      <Glows />
      {/* Shared top bar: back button + kana chart button, plus the step title/dots — only during a
          Study-tab learn/practice session. StudyView stays mounted across tabs (see below), so without
          gating on `onStudy` its session header would bleed onto Stats/Settings.
          The chart follows step progress, or an explicit `help` opt-in for screens (grammar) that
          render their own progress instead of the shared dots. */}
      <View style={[styles.topRow, { paddingTop: insets.top + 4 }]}>
        {onStudy && header.back ? <BackButton onPress={header.back} /> : <View style={styles.topSpacer} />}
        {onStudy && (header.progress != null || header.help) ? <HelpButton /> : <View style={styles.topSpacer} />}
      </View>
      {onStudy && header.title && (
        <View style={styles.titleRow}>
          <Bilingual native={header.title.ja} en={header.title.en} />
        </View>
      )}
      {onStudy && header.progress != null && (
        <View style={styles.dotsRow}>
          {Array.from({ length: header.progress.total }, (_, k) => (
            <View key={k} style={[styles.dot, k < header.progress!.current && styles.dotOn]} />
          ))}
        </View>
      )}
      {/* Study stays mounted (just hidden) while you're on another tab, so an in-progress practice/learn
          session keeps its exact place — hop to Stats/Settings and come back to the same question. */}
      <View style={[styles.studyBody, !onStudy && styles.hidden]}>
        <FadeView key="study" style={styles.fill}>
          <StudyView />
        </FadeView>
      </View>
      {!onStudy && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!scrollLocked}
        >
          <FadeView key={tab}>{tab === 'stats' ? <StatsView /> : <SettingsView />}</FadeView>
        </ScrollView>
      )}
      {/* Bottom bar pinned to the very bottom; its padding absorbs the home-indicator inset. */}
      <View style={[styles.tabbar, { paddingBottom: insets.bottom + 2 }]}>
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Icon name={t.icon} size={20} color={active ? colors.accentInk : colors.muted} />
              <Text style={[styles.tabLabel, { color: active ? colors.accentInk : colors.muted }]}>
                {t.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      </Animated.View>
    </View>
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 2,
  },
  topSpacer: { width: 40, height: 40 }, // keeps the help button pinned right when there's no back button
  titleRow: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  dotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, flexGrow: 1 },
  studyBody: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  hidden: { display: 'none' },
  fill: { flex: 1 },
  tabbar: {
    flexDirection: 'row',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.panel,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  tabLabel: { fontFamily: fonts.body, fontSize: 11 },
})
