/** A hiragana reference chart: gojūon, voiced (dakuten/handakuten), and combos (yōon). */

type Cell = [kana: string, romaji: string] | null

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
  [['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go']],
  [['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo']],
  [['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do']],
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

function Grid({
  rows,
  cols,
  cellWidth = '1.8rem',
}: {
  rows: Cell[][]
  cols: number
  cellWidth?: string
}) {
  return (
    <div className="kana-grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cellWidth})` }}>
      {rows.flat().map((cell, i) =>
        cell ? (
          <div key={i} className="kana-cell">
            <span className="kana">{cell[0]}</span>
            <span className="romaji">{cell[1]}</span>
          </div>
        ) : (
          <div key={i} className="kana-cell empty" aria-hidden="true" />
        ),
      )}
    </div>
  )
}

export function HiraganaTable() {
  return (
    <div className="kana-chart">
      <section className="kana-section">
        <Grid rows={GOJUON} cols={5} />
      </section>
      <section className="kana-section">
        <Grid rows={DAKUTEN} cols={5} />
      </section>
      <section className="kana-section">
        <Grid rows={YOON} cols={3} cellWidth="2.4rem" />
      </section>
    </div>
  )
}
