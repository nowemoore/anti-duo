import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { KanaWord } from '../../../shared/types'
import {
  filterKanaWords,
  isReadable,
  isWordMet,
  kanaCategoryOptions,
  kanaScriptOptions,
  type KanaWordFilters,
} from '../../lib/kana'
import { Legend } from '../Legend'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'

/**
 * The kana half of the vocabulary, as a board of word tiles.
 *
 * Every word is here and every word is open. Readability gates the *kana course*, where the point is
 * learning to read; here it would be the wrong rule twice over — this section assumes you can
 * already read kana, and the two courses are independent. Pick any word you like.
 *
 * Three tile states, and no more, because three is what the data supports: whether you have opened
 * the word, and whether every character in it is one you have traced. Nothing tracks a kana word's
 * own mastery, so "readable" is the strongest claim available — there is no ramp to shade along and
 * no "ready for more", which is about a kanji's example words unlocking and has no counterpart here.
 */
export function KanaWordBoard({ onSelect }: { onSelect: (w: KanaWord) => void }) {
  const index = useContent()
  const { progress } = useProgress()
  const words = index.content.kanaWords ?? []
  const [filters, setFilters] = useState<KanaWordFilters>({ script: null, category: null })

  const shown = useMemo(() => filterKanaWords(words, filters), [words, filters])
  // Each filter's options counted against the *other*, so the pair reads as one query.
  const scripts = useMemo(
    () => kanaScriptOptions(words, { category: filters.category }),
    [words, filters.category],
  )
  const categories = useMemo(
    () => kanaCategoryOptions(words, { script: filters.script }),
    [words, filters.script],
  )
  const filtered = Boolean(filters.script?.length || filters.category?.length)

  return (
    <div className="board">
      <Legend
        items={[
          { swatchClass: 'tile-unseen', label: 'not viewed' },
          { swatchClass: 'tile-introduced', label: 'opened' },
          { swatchClass: 'tile-learnt', label: 'readable' },
        ]}
      />

      <div className="board-filters">
        <label className="board-filter">
          <span className="board-filter-label">Script</span>
          <select
            value={filters.script?.[0] ?? ''}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                script: e.target.value ? [e.target.value as KanaWord['script']] : null,
              }))
            }
          >
            <option value="">Both scripts</option>
            {scripts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.value} ({s.count})
              </option>
            ))}
          </select>
        </label>

        <label className="board-filter">
          <span className="board-filter-label">Topic</span>
          <select
            value={filters.category?.[0] ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, category: e.target.value ? [e.target.value] : null }))
            }
          >
            <option value="">All topics</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count})
              </option>
            ))}
          </select>
        </label>

        {filtered && (
          <button
            type="button"
            className="board-filter-clear"
            onClick={() => setFilters({ script: null, category: null })}
          >
            <FontAwesomeIcon icon="xmark" />
            Clear
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="board-empty">No words match those filters.</p>
      ) : (
        <div className="board-grid word-grid">
          {shown.map((w) => {
            const met = isWordMet(progress, w.idx)
            const state = !met ? 'unseen' : isReadable(progress, w) ? 'learnt' : 'introduced'
            return (
              <button
                key={w.idx}
                type="button"
                className={`tile word-tile ${state}`}
                aria-label={`${w.word}, ${state === 'learnt' ? 'readable' : state === 'introduced' ? 'opened' : 'not viewed'}`}
                onClick={() => onSelect(w)}
              >
                {w.word}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
