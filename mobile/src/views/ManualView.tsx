import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import { Icon } from '../components/Icon'
import { colors, fonts, radius, spacing } from '../theme'

const TASKS: { title: string; desc: string }[] = [
  {
    title: 'Type the reading',
    desc: "You're shown a word — type its reading in kana. Type romaji and it converts as you go. After you answer, the 🔊 reads it and the meaning appears.",
  },
  {
    title: 'Which words are real',
    desc: 'You see one kanji and four words; select those that use it correctly. After answering, the real words turn green — hold one for its reading & meaning.',
  },
  {
    title: 'Fill in the kanji',
    desc: 'A sentence is missing one kanji (its reading stays above the blank). Pick the kanji that belongs there.',
  },
  {
    title: 'Pick the reading',
    desc: 'One word in a sentence is highlighted — choose its correct reading. Tap the 🔊 on each option to hear it.',
  },
  {
    title: 'Pick the meaning',
    desc: "One kanji in a sentence is highlighted — choose the kanji's meaning.",
  },
  {
    title: 'Draw the kanji',
    desc: "You're given a word's reading — write it on the canvas with your finger, then lock in your answer. Your strokes are recognized on-device (Undo/Clear, or No clue to give up). Only offered once you've learned every kanji in the word, and you also write each new set right after learning it.",
  },
]

const POINTS: string[] = [
  'Pick your kanji. In Settings → Your learning, switch whole categories on/off, or expand one to toggle individual kanji.',
  'Tune the mix. In Settings → Practice mix, drag a slider to change how often each question type appears (0 = off).',
  'Set your name. In Settings → Profile, so the home screen greets you.',
  'Hiragana chart. Hold the ? in the top-right any time for a kana reference (release to hide).',
  'Start over. Use reset progress on the Study home to clear your unlocked kanji and levels (name + selection are kept).',
]

export function ManualView() {
  return (
    <View style={{ gap: spacing.lg }}>
      <Text style={styles.title}>How to Use This Tool</Text>

      <Section title="About">
        <Text style={styles.p}>
          Anti-Duo helps you learn kanji and lock them in with quick practice. Everything happens
          from the Study tab in two moves:
        </Text>
        <Bullet>
          <Text style={styles.bold}>Learn</Text> introduces 5 new kanji at a time — meaning, real
          example words, and a breakdown of each one's radical + parts (tap the magnifying glass).
        </Bullet>
        <Bullet>
          <Text style={styles.bold}>Practice</Text> quizzes you on kanji you've unlocked. Answer
          right and a kanji levels up; miss it and it comes back around.
        </Bullet>
      </Section>

      <Section title="Task Types">
        <Text style={styles.muted}>
          Practice rotates through these six question types. After each, the correct answer shows in
          green; hold parts of the question to reveal readings, or tap the 🔊 to hear them.
        </Text>
        {TASKS.map((t, i) => (
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
        {POINTS.map((p, i) => (
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
          with details (what happened, what you expected, which kanji/task, screenshots). Thank you!
        </Text>
      </View>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.h2}>{title}</Text>
      {children}
    </View>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.dot}>•</Text>
      <Text style={styles.p}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
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
