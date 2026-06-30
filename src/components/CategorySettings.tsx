import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import {
  enabledKanjiCount,
  isCategoryEnabled,
  isKanjiEnabled,
  toggleInList,
} from '../lib/categories'
import { Toggle } from './Toggle'

/** Settings section: pick which kanji to study by toggling categories or individual kanji. */
export function CategorySettings() {
  const index = useContent()
  const { progress, update } = useProgress()
  const settings = progress.settings
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggleExpand = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const toggleCategory = (name: string) =>
    update((p) => {
      const disabledCategories = toggleInList(p.settings.disabledCategories, name)
      const newSettings = { ...p.settings, disabledCategories }
      // Keep at least one kanji in play.
      if (enabledKanjiCount(index, newSettings) === 0) return p
      return { ...p, settings: newSettings }
    })

  const toggleKanji = (idx: number) =>
    update((p) => {
      const disabledKanji = toggleInList(p.settings.disabledKanji, idx)
      const newSettings = { ...p.settings, disabledKanji }
      if (enabledKanjiCount(index, newSettings) === 0) return p
      return { ...p, settings: newSettings }
    })

  return (
    <section className="panel settings">
      <h2>Your learning</h2>
      <p className="muted">Pick which kanji to study. Expand a category to fine-tune individual kanji.</p>

      <div className="cat-list">
        {index.categories.map((cat) => {
          const catOn = isCategoryEnabled(settings, cat.name)
          const isOpen = catOn && expanded.has(cat.name)
          const enabledInCat = cat.kanji.filter((k) => isKanjiEnabled(settings, k)).length

          return (
            <div key={cat.name} className={`cat-block${catOn ? '' : ' off'}`}>
              <div className="cat-row">
                <button
                  type="button"
                  className={`cat-expand${isOpen ? ' open' : ''}`}
                  aria-label={`Show ${cat.name} kanji`}
                  disabled={!catOn}
                  onClick={() => toggleExpand(cat.name)}
                >
                  <FontAwesomeIcon icon="chevron-down" />
                </button>
                <span className="cat-name">{cat.name}</span>
                <span className="cat-count">
                  {enabledInCat}/{cat.kanji.length}
                </span>
                <Toggle checked={catOn} onChange={() => toggleCategory(cat.name)} label={cat.name} />
              </div>

              {/* Always rendered so it can roll out / collapse smoothly via CSS (grid-rows). */}
              <div className={`cat-content${isOpen ? ' open' : ''}`}>
                <ul className="cat-kanji">
                  {cat.kanji.map((k) => (
                    <li key={k.idx} className="ck-item">
                      <span className="ck-char">{k.char}</span>
                      <span className="ck-gloss">{k.gloss.join(', ')}</span>
                      <Toggle
                        checked={!settings.disabledKanji.includes(k.idx)}
                        onChange={() => toggleKanji(k.idx)}
                        label={k.char}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
