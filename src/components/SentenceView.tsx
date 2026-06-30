import type { ReactNode } from 'react'
import type { Token } from '../../shared/types'
import { contentTokenDisplay } from '../lib/learned'
import { useLearned } from '../lib/useLearned'
import { HoverGloss } from './HoverGloss'

export interface TokenOverride {
  /** Cloze: hide this single kanji char in the word, keep furigana + other chars (T3a). */
  blankChar?: string
  /** Show the full word in Japanese with always-on furigana (cloze reveal). */
  forceJaFurigana?: boolean
  /** Visually highlight this token (T3b/T3c target). */
  highlight?: boolean
  /** Don't reveal the reading on hover so it isn't given away (T3b). */
  hideReading?: boolean
  /** Don't reveal the meaning on hover so it isn't given away (T3c). */
  hideMeaning?: boolean
}

interface SentenceViewProps {
  tokens: Token[]
  /** Per-token-index overrides for task rendering. */
  overrides?: Record<number, TokenOverride>
  className?: string
  /** Allow meanings to appear on hover (only after a task is answered). Reading always may show. */
  revealMeanings?: boolean
}

/** Renders a sentence with learned-aware English/Japanese display and task overrides. */
export function SentenceView({
  tokens,
  overrides,
  className,
  revealMeanings = false,
}: SentenceViewProps) {
  const isLearned = useLearned()

  return (
    <span className={className ? `sentence ${className}` : 'sentence'}>
      {tokens.map((tok, i) => {
        const o = overrides?.[i]
        const key = i

        if (tok.kind === 'particle') {
          return (
            <span key={key} className="tok scaffold">
              {tok.kana}
            </span>
          )
        }

        // Cloze blank: always show the word in Japanese with furigana, one char hidden.
        if (o?.blankChar) {
          return (
            <span key={key} className="tok content word cloze">
              <ruby>
                {blankOut(tok.ja, o.blankChar)}
                <rt>{tok.reading}</rt>
              </ruby>
            </span>
          )
        }

        // Cloze reveal: full word in Japanese with furigana, highlighted, meaning on hover.
        if (o?.forceJaFurigana) {
          return (
            <HoverGloss
              key={key}
              gloss={tok.en}
              enabled
              className={`tok content word jp${o.highlight ? ' highlight' : ''}`}
            >
              <ruby>
                {tok.ja}
                <rt>{tok.reading}</rt>
              </ruby>
            </HoverGloss>
          )
        }

        const display = contentTokenDisplay(tok, isLearned)
        const cls = `tok content${o?.highlight ? ' highlight' : ''}`

        if (display === 'english') {
          return (
            <span key={key} className={`${cls} en`}>
              {tok.en}
            </span>
          )
        }

        return (
          <GlossWord
            key={key}
            className={cls}
            ja={tok.ja}
            reading={tok.reading}
            en={tok.en}
            showReading={!o?.hideReading}
            showMeaning={revealMeanings && !o?.hideMeaning}
          />
        )
      })}
    </span>
  )
}

/** Replace the first occurrence of `char` in `ja` with a blank box, keeping the rest. */
function blankOut(ja: string, char: string): ReactNode[] {
  const at = ja.indexOf(char)
  if (at < 0) return [ja]
  return [
    ja.slice(0, at),
    <span key="blank" className="cloze-blank" aria-label="blank" />,
    ja.slice(at + char.length),
  ]
}

interface GlossWordProps {
  ja: string
  reading: string
  en: string
  showReading: boolean
  showMeaning: boolean
  className: string
}

/** A learned Japanese word: plain kanji; reading and/or meaning revealed in a cursor bubble on hover. */
function GlossWord({ ja, reading, en, showReading, showMeaning, className }: GlossWordProps) {
  const parts: string[] = []
  if (showReading) parts.push(reading)
  if (showMeaning) parts.push(en)
  const gloss = parts.join('  ·  ')

  return (
    <HoverGloss gloss={gloss} enabled={parts.length > 0} className={`${className} word jp`}>
      {ja}
    </HoverGloss>
  )
}
