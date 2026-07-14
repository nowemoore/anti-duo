import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import { Icon } from '../components/Icon'
import { useLanguage } from '../context/LanguageContext'
import { fonts, radius, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

export function ManualView() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { ui } = useLanguage()
  return (
    <View style={{ gap: spacing.lg }}>
      <Text style={styles.title}>How to Use This Tool</Text>

      <Section title="About">
        <Text style={styles.p}>
          Anti-Duo helps you learn {ui.noun} and lock them in with quick practice. Everything happens
          from the Study tab in two moves:
        </Text>
        <Bullet>
          <Text style={styles.bold}>Learn</Text> introduces 5 new {ui.noun} at a time — meaning, real
          example words, and a breakdown of each one's radical + parts (tap the magnifying glass).
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Practice</Text> quizzes you on {ui.noun} you've unlocked. Answer
          right and a {ui.noun} levels up; miss it and it comes back around.
        </Bullet>
      </Section>

      <Section title="Task Types">
        <Text style={styles.muted}>
          Practice rotates through these six question types. After each, the correct answer shows in
          green; hold parts of the question to reveal readings, or tap the 🔊 to hear them.
        </Text>
        {ui.manual.tasks.map((t, i) => (
          <View key={t.title} style={styles.task}>
            <View style={styles.taskNo}>
              <Text style={styles.taskNoText}>{i + 1}</Text>
            </View>
            <View style={styles.taskBody}>
              <Text style={styles.taskTitle}>{t.title}</Text>
              <Text style={styles.taskDesc}>{t.desc}</Text>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Personalise">
        {ui.manual.points.map((p, i) => (
          <Bullet key={i}>{p}</Bullet>
        ))}
      </Section>

      <View style={[styles.panel, styles.helpPanel]}>
        <View style={styles.helpHead}>
          <Icon name="envelope" size={15} color={colors.accentInk} />
          <Text style={styles.helpTitle}>Want to help make the tool better?</Text>
        </View>
        <Text style={styles.p}>
          Found a bug or think something could run better? Email{' '}
          <Text style={styles.link} onPress={() => Linking.openURL('mailto:nowe.moore@gmail.com')}>
            nowe.moore@gmail.com
          </Text>{' '}
          with details (what happened, what you expected, which {ui.noun}/task, screenshots). Thank you!
        </Text>
      </View>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.panel}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.dot}>•</Text>
      <Text style={styles.p}>{children}</Text>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  title: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 24, textAlign: 'center' },
  panel: { backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: 8 },
  h2: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20, marginBottom: 4 },
  p: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, flex: 1 },
  muted: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  bold: { fontFamily: fonts.semibold, color: colors.ink },
  bulletRow: { flexDirection: 'row', gap: 8 },
  dot: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  task: { flexDirection: 'row', gap: 10, marginTop: 10 },
  taskNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  taskNoText: { color: colors.c900, fontFamily: fonts.bold, fontSize: 13 },
  taskBody: { flex: 1 },
  taskTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  taskDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 2 },
  helpPanel: { backgroundColor: colors.accentSoft, borderColor: 'rgba(227,152,221,0.3)' },
  helpHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  helpTitle: { color: colors.accentInk, fontFamily: fonts.headingBold, fontSize: 16, flex: 1 },
  link: { color: colors.accentInk, fontFamily: fonts.semibold, textDecorationLine: 'underline' },
})
