/** A hiragana reference chart: gojūon, voiced (dakuten/handakuten), and combos (yōon). */
import { chartRomaji, findScript, type ChartSection } from '../lib/kana'

function Grid({ section }: { section: ChartSection }) {
  const cols = Math.max(...section.rows.map((r) => r.length))
  return (
    <div
      className="kana-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, ${section.wide ? '2.4rem' : '1.8rem'})` }}
    >
      {section.rows.flat().map((char, i) =>
        char ? (
          <div key={i} className="kana-cell">
            <span className="kana">{char}</span>
            <span className="romaji">{chartRomaji(char)}</span>
          </div>
        ) : (
          <div key={i} className="kana-cell empty" aria-hidden="true" />
        ),
      )}
    </div>
  )
}

export function HiraganaTable() {
  const hiragana = findScript('ja', 'hiragana')
  if (!hiragana) return null
  return (
    <div className="kana-chart">
      {hiragana.sections.map((section) => (
        <section key={section.id} className="kana-section">
          <Grid section={section} />
        </section>
      ))}
    </div>
  )
}
