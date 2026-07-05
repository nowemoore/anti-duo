import { View, Text, StyleSheet } from 'react-native'
import { colors, fonts } from '../theme'

type Cell = [kana: string, romaji: string] | null

// Data is stored consonant-row × vowel-column; we transpose at render so consonants run across the
// x-axis and vowels down the y-axis, then stack the three sections vertically.
const GOJUON: Cell[][] = [
  [['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o']],
  [['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko']],
  [['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so']],
  [['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to']],
  [['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no']],
  [['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho']],
  [['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo']],
  [['や', 'ya'], null, ['ゆ', 'yu'], null, ['よ', 'yo']],
  [['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro']],
  [['わ', 'wa'], null, null, null, ['を', 'wo']],
  [['ん', 'n'], null, null, null, null],
]

const DAKUTEN: Cell[][] = [
  // Empty leading "consonant" → after transpose it's an empty first column, so the voiced kana
  // start from column two and line up under their base consonants (k→g, s→z, t→d, …).
  [null, null, null, null, null],
  [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']],
  [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']],
  [['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do']],
  // Gap after the da/za columns → the b/p rows line up under は-column (their base).
  [null, null, null, null, null],
  [['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo']],
  [['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po']],
]

const YOON: Cell[][] = [
  [['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo']],
  [['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho']],
  [['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho']],
  [['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo']],
  [['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo']],
  [['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo']],
  [['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo']],
  [['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo']],
  [['じゃ', 'ja'], ['じゅ', 'ju'], ['じょ', 'jo']],
  [['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo']],
  [['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo']],
]

function transpose(rows: Cell[][]): Cell[][] {
  const cols = Math.max(...rows.map((r) => r.length))
  const out: Cell[][] = []
  for (let c = 0; c < cols; c++) out.push(rows.map((r) => r[c] ?? null))
  return out
}

function Grid({ rows, wide }: { rows: Cell[][]; wide?: boolean }) {
  return (
    <View style={styles.grid}>
      {transpose(rows).map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((cell, c) =>
            cell ? (
              <View key={c} style={[styles.cell, wide && styles.cellWide]}>
                <Text style={styles.kana}>{cell[0]}</Text>
                <Text style={styles.romaji}>{cell[1]}</Text>
              </View>
            ) : (
              <View key={c} style={[styles.cell, wide && styles.cellWide, styles.empty]} />
            ),
          )}
        </View>
      ))}
    </View>
  )
}

export function HiraganaTable() {
  return (
    <View style={styles.chart}>
      <Grid rows={GOJUON} />
      <Grid rows={DAKUTEN} />
      <Grid rows={YOON} wide />
    </View>
  )
}

const kanaBg = 'rgba(227,152,221,0.20)'
const styles = StyleSheet.create({
  // Left-aligned so the vowel column (down the left edge) lines up across all three sections.
  chart: { alignItems: 'flex-start', gap: 8 },
  grid: { gap: 2 },
  row: { flexDirection: 'row', gap: 2 },
  cell: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(227,152,221,0.4)',
    borderRadius: 4,
    backgroundColor: kanaBg,
  },
  cellWide: { width: 27 },
  empty: { borderWidth: 0, backgroundColor: 'transparent' },
  kana: { fontSize: 13, color: colors.ink },
  romaji: { fontSize: 8, color: colors.muted, fontFamily: fonts.body },
})
