import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native'
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
import './src/icons' // registers the FontAwesome library (side effect)
import { setupPwa } from './src/web/pwa'
import { LanguageProvider } from './src/context/LanguageContext'
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
import { colors, fonts, spacing } from './src/theme'

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
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('study')
  const [scrollLocked, setScrollLocked] = useState(false)
  const header = useHeaderConfig()
  return (
    <ScrollLockContext.Provider value={setScrollLocked}>
    <View style={styles.app}>
      {/* Soft color pools behind the frosted panels so the "glass" has something to reveal. */}
      <View pointerEvents="none" style={styles.glowA} />
      <View pointerEvents="none" style={styles.glowB} />
      <StatusBar style="light" />
      {/* Shared top bar: back button (top-left) + kana chart button — only during a learn/practice session. */}
      <View style={[styles.topRow, { paddingTop: insets.top + 4 }]}>
        {header.back ? <BackButton onPress={header.back} /> : <View style={styles.topSpacer} />}
        {header.progress != null ? <HelpButton /> : <View style={styles.topSpacer} />}
      </View>
      {header.title && (
        <View style={styles.titleRow}>
          <Bilingual native={header.title.ja} en={header.title.en} />
        </View>
      )}
      {header.progress != null && (
        <View style={styles.dotsRow}>
          {Array.from({ length: header.progress.total }, (_, k) => (
            <View key={k} style={[styles.dot, k < header.progress!.current && styles.dotOn]} />
          ))}
        </View>
      )}
      {tab === 'study' ? (
        // Study cards fill the fixed area between the dots and the tab bar (they scroll inside).
        <View style={styles.studyBody}>
          <FadeView key="study" style={styles.fill}>
            <StudyView />
          </FadeView>
        </View>
      ) : (
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
    </View>
    </ScrollLockContext.Provider>
  )
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  glowA: { position: 'absolute', top: -130, left: -90, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(227,152,221,0.11)' },
  glowB: { position: 'absolute', bottom: -70, right: -110, width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(138,172,171,0.08)' },
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
