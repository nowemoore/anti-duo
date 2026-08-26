/** A hiragana reference chart: gojūon, voiced (dakuten/handakuten), and combos (yōon). */
import { findScript } from '../lib/kana'
import { KanaGrid } from './kana/KanaGrid'

export function HiraganaTable() {
  const hiragana = findScript('ja', 'hiragana')
  if (!hiragana) return null
  return (
    <div className="kana-chart">
      {hiragana.sections.map((section) => (
        <section key={section.id} className="kana-section">
          {/* Read-only and unshaded: this is the reference behind the help button, not the
              curriculum. The Learn kana page renders the same grids large and clickable. */}
          <KanaGrid section={section} />
        </section>
      ))}
    </div>
  )
}
