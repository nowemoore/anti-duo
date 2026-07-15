import { View, Text, StyleSheet } from 'react-native'
import { VoweledText } from '../../components/VoweledText'
import { fonts, type Palette } from '../../theme'
import { useStyles } from '../../hooks/theme'

// The 28 letters of the Arabic alphabet (isolated form + Latin transliteration), in abjadī... no —
// in the standard alphabetical (hijāʾī) order learners meet first.
const LETTERS: [string, string][] = [
  ['ا', 'ā'], ['ب', 'b'], ['ت', 't'], ['ث', 'th'], ['ج', 'j'], ['ح', 'ḥ'], ['خ', 'kh'],
  ['د', 'd'], ['ذ', 'dh'], ['ر', 'r'], ['ز', 'z'], ['س', 's'], ['ش', 'sh'], ['ص', 'ṣ'],
  ['ض', 'ḍ'], ['ط', 'ṭ'], ['ظ', 'ẓ'], ['ع', 'ʿ'], ['غ', 'gh'], ['ف', 'f'], ['ق', 'q'],
  ['ك', 'k'], ['ل', 'l'], ['م', 'm'], ['ن', 'n'], ['ه', 'h'], ['و', 'w'], ['ي', 'y'],
]

// Diacritics shown on a ب carrier, built from code points so the combining marks are unambiguous.
const CARRIER = 'ب'
const FATHA = 'َ'
const DAMMA = 'ُ'
const KASRA = 'ِ'
const SUKUN = 'ْ'
const SHADDA = 'ّ'
const TANWIN_FATH = 'ً'
const TANWIN_DAMM = 'ٌ'
const TANWIN_KASR = 'ٍ'

/** [voweled carrier, sound, mark name] */
const SHORT: [string, string, string][] = [
  [CARRIER + FATHA, 'a', 'fatḥa'],
  [CARRIER + DAMMA, 'u', 'ḍamma'],
  [CARRIER + KASRA, 'i', 'kasra'],
]

const MARKS: [string, string, string][] = [
  [CARRIER + SUKUN, '—', 'sukūn'],
  [CARRIER + SHADDA + FATHA, 'bba', 'shadda'],
]

const TANWIN: [string, string, string][] = [
  [CARRIER + TANWIN_FATH, 'an', 'tanwīn'],
  [CARRIER + TANWIN_DAMM, 'un', 'tanwīn'],
  [CARRIER + TANWIN_KASR, 'in', 'tanwīn'],
]

const LONG: [string, string, string][] = [
  [CARRIER + FATHA + 'ا', 'ā', 'alif'],
  [CARRIER + DAMMA + 'و', 'ū', 'wāw'],
  [CARRIER + KASRA + 'ي', 'ī', 'yāʾ'],
]

// Positional forms drawn with a tatweel (kashida) — a VISIBLE connecting stroke — so beginning/middle/
// end are actually distinguishable. (A zero-width joiner also yields the right shapes, but the join is
// invisible, which makes the initial and medial forms look identical.)
//
// Six letters never connect to the FOLLOWING letter: ا د ذ ر ز و. They only join backwards, so a
// trailing tatweel would draw a bogus floating dash. For them the beginning form is just the isolated
// letter, and the middle form is the same as the end — which is exactly how they behave in a word.
const TATWEEL = 'ـ'
const NON_JOINERS = new Set(['ا', 'د', 'ذ', 'ر', 'ز', 'و'])
const joinsForward = (x: string) => !NON_JOINERS.has(x)

const beginning = (x: string) => (joinsForward(x) ? x + TATWEEL : x)
const middle = (x: string) => (joinsForward(x) ? TATWEEL + x + TATWEEL : TATWEEL + x)
const end = (x: string) => TATWEEL + x

/** One consonant as a table-like card: fixed columns (glyph · translit | beginning · middle · end). */
function ConsonantCard({ glyph, tr }: { glyph: string; tr: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.cCard}>
      <Text style={styles.cIso}>{glyph}</Text>
      <Text style={styles.cTr}>{tr}</Text>
      <View style={styles.cDiv} />
      <Text style={styles.cForm}>{beginning(glyph)}</Text>
      <Text style={styles.cForm}>{middle(glyph)}</Text>
      <Text style={styles.cForm}>{end(glyph)}</Text>
    </View>
  )
}

/** One vowel/mark as a card: the voweled carrier + its sound and name. */
function VowelCard({ glyph, sound, name }: { glyph: string; sound: string; name: string }) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.vCard}>
      <VoweledText text={glyph} style={styles.vGlyph} />
      <Text style={styles.vSub}>
        {sound} · {name}
      </Text>
    </View>
  )
}

/**
 * The active pack's script reference for Arabic. Sized to fit the hold-to-view card without scrolling:
 * consonants in two columns (each with its positional forms), then long vowels, short vowels, and the
 * remaining marks.
 */
export function ArabicChart() {
  const styles = useStyles(makeStyles)
  const rest = [...MARKS, ...TANWIN]
  return (
    <View style={styles.chart}>
      <Text style={styles.section}>Consonants — beginning · middle · end</Text>
      <View style={styles.consonants}>
        {LETTERS.map(([glyph, tr], i) => (
          <ConsonantCard key={i} glyph={glyph} tr={tr} />
        ))}
      </View>

      {/* Long + short vowels sit side by side to keep the whole chart on one screen. */}
      <View style={styles.vowelRow}>
        <View style={styles.vowelGroup}>
          <Text style={styles.section}>Long vowels</Text>
          <View style={styles.vrow}>
            {LONG.map(([glyph, sound, name], i) => (
              <VowelCard key={i} glyph={glyph} sound={sound} name={name} />
            ))}
          </View>
        </View>
        <View style={styles.vowelGroup}>
          <Text style={styles.section}>Short vowels</Text>
          <View style={styles.vrow}>
            {SHORT.map(([glyph, sound, name], i) => (
              <VowelCard key={i} glyph={glyph} sound={sound} name={name} />
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.section}>Sukūn · shadda · tanwīn</Text>
      <View style={styles.vrow}>
        {rest.map(([glyph, sound, name], i) => (
          <VowelCard key={i} glyph={glyph} sound={sound} name={name} />
        ))}
      </View>
    </View>
  )
}

const card = (colors: Palette) => ({
  borderWidth: 1,
  borderColor: colors.accentHover,
  borderRadius: 6,
  backgroundColor: colors.accentSoft,
})

const makeStyles = (colors: Palette) => StyleSheet.create({
  chart: { width: '100%', gap: 3 },
  section: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 10, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Consonants: two columns of cards. Fixed-width sub-columns so the glyph, translit, and each of the
  // beginning/middle/end forms line up across every card — a "wanna-be table".
  consonants: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6, rowGap: 4 },
  cCard: { ...card(colors), width: '48%', flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 5, gap: 2 },
  cIso: { width: 20, textAlign: 'center', fontSize: 17, color: colors.ink, lineHeight: 22 },
  cTr: { width: 24, textAlign: 'center', fontSize: 9, color: colors.muted, fontFamily: fonts.body },
  cDiv: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: 2 },
  cForm: { width: 23, textAlign: 'center', fontSize: 14, color: colors.ink, lineHeight: 22 },

  // Vowels/marks: compact cards; long + short vowel groups share a row, so keep them tight enough to fit.
  vowelRow: { flexDirection: 'row', gap: 10 },
  vowelGroup: { gap: 3 },
  vrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  vCard: { ...card(colors), alignItems: 'center', paddingVertical: 2, paddingHorizontal: 4, minWidth: 42 },
  vGlyph: { fontSize: 16, color: colors.ink, lineHeight: 22 },
  vSub: { fontSize: 7, color: colors.muted, fontFamily: fonts.body },
})
