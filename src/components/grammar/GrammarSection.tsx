import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { GrammarItemResult } from '../../../shared/types'
import {
  availableItemCount,
  hasPassed,
  isPartUnlocked,
  missingRequiredUnits,
  isReflectionComplete,
  markVocabDone,
  passProgress,
  recordAttempt,
  reflectionAnsweredCount,
  saveReflection,
  topicProgress,
  type GrammarTopic,
  type PartId,
} from '../../lib/grammar'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { Bilingual } from '../Bilingual'
import { PartCard } from './PartCard'
import { VocabIntro } from './VocabIntro'
import { FormMinigame } from './FormMinigame'
import { Reflection } from './Reflection'
import { Explanation, ExplanationLocked } from './Explanation'

/**
 * One grammar subsection, rendered entirely from a {@link GrammarTopic}. The four parts unlock in
 * order and stay open-able once unlocked; adding a second topic needs no change here.
 */
export function GrammarSection({ topic, onBack }: { topic: GrammarTopic; onBack: () => void }) {
  const { progress, update } = useProgress()
  const index = useContent()
  const tp = topicProgress(progress, topic.id)

  // Everything a learner-derived item bank needs. Memoized so the bank isn't rebuilt every render.
  const ctx = useMemo(() => ({ index, progress }), [index, progress])
  const availableItems = availableItemCount(topic, ctx)
  const neededItems = topic.minigame.minItems ?? 0

  const unlocked = (p: PartId) => isPartUnlocked(p, tp, topic, ctx)
  // Two different things can hold part 2 back; the hint has to say which one applies.
  const missingUnits = missingRequiredUnits(topic, ctx)
  const missingForms = missingUnits.map((idx) => index.byIdx.get(idx)?.form ?? '').filter(Boolean)
  const passed = hasPassed(tp)
  const reflectionDone = isReflectionComplete(topic, tp)
  const reflectionCount = reflectionAnsweredCount(topic, tp)
  const promptTotal = topic.reflection.prompts.length

  // Open the furthest part the learner can actually act on, until they choose otherwise.
  const [open, setOpen] = useState<PartId | null>(() =>
    !unlocked('minigame')
      ? 'vocab'
      : !unlocked('reflection')
        ? 'minigame'
        : !unlocked('explanation')
          ? 'reflection'
          : 'explanation',
  )
  const toggle = (p: PartId) => setOpen((cur) => (cur === p ? null : p))

  const finishVocab = () => {
    update((p) => markVocabDone(p, topic.id, new Date().toISOString()))
    setOpen('minigame')
  }

  const finishAttempt = (results: GrammarItemResult[]) => {
    update((p) => recordAttempt(p, topic, results, new Date().toISOString()))
  }

  const writeReflection = (questionId: string, answer: string) => {
    update((p) => saveReflection(p, topic.id, questionId, answer, new Date().toISOString()))
  }

  const pass = passProgress(tp)
  const attemptCount = tp.attempts.length

  return (
    <section className="panel grammar-section">
      <div className="practice-head">
        <button type="button" className="practice-back" onClick={onBack} aria-label="Back to grammar topics">
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <h2>
          <Bilingual ja={topic.titleNative} en={topic.titleEn} />
        </h2>
      </div>

      <p className="grammar-blurb">{topic.blurb}</p>

      <PartCard
        step={1}
        icon="graduation-cap"
        title={topic.vocab.title}
        subtitle={`${topic.vocab.words.length} words`}
        locked={false}
        done={tp.vocabDoneAt != null}
        open={open === 'vocab'}
        onToggle={() => toggle('vocab')}
      >
        <VocabIntro
          words={topic.vocab.words}
          note={topic.vocab.note}
          onDone={finishVocab}
          doneLabel="Got it"
        />
      </PartCard>

      <PartCard
        step={2}
        icon="dumbbell"
        title={topic.minigame.title}
        // Before the first attempt the framing lives inside the part, not in this one-liner.
        subtitle={
          attemptCount === 0
            ? undefined
            : `best ${Math.round(pass.best * 100)}% · ${attemptCount} attempt${attemptCount === 1 ? '' : 's'}`
        }
        locked={!unlocked('minigame')}
        // Two different reasons to be locked; say which one applies, and give the real count so the
        // requirement is a target rather than a closed door.
        lockedHint={
          tp.vocabDoneAt == null
            ? `Go through the ${topic.vocab.title.toLowerCase()} first.`
            : missingForms.length > 0
              ? `The questions are framed with ${missingForms.join(' ')} — learn ${missingForms.length === 1 ? 'that kanji' : 'those kanji'} first.`
              : `You need ${neededItems} verbs to start — you know ${availableItems}. Learn more kanji and come back.`
        }
        done={passed}
        open={open === 'minigame'}
        onToggle={() => toggle('minigame')}
      >
        <FormMinigame topic={topic} ctx={ctx} onFinish={finishAttempt} />
      </PartCard>

      <PartCard
        step={3}
        icon="pen-nib"
        title={topic.reflection.title}
        subtitle={
          reflectionCount === 0
            ? `${promptTotal} questions · saved as you type`
            : `${reflectionCount}/${promptTotal} answered`
        }
        locked={!unlocked('reflection')}
        lockedHint="Play the game once to unlock this."
        done={reflectionDone}
        open={open === 'reflection'}
        onToggle={() => toggle('reflection')}
      >
        <Reflection topic={topic} tp={tp} ctx={ctx} onSave={writeReflection} />
      </PartCard>

      {/*
        Two gates, in this order: write your own account of the pattern first, then clear the
        threshold. While the reflection is outstanding the card won't open at all — but its hint
        still spells out the accuracy bar, so the requirement is never a surprise.
      */}
      <PartCard
        step={4}
        icon="book"
        title={topic.explanation.title}
        subtitle="The rules behind the game"
        locked={!reflectionDone}
        lockedHint={
          reflectionCount === 0
            ? `Answer the ${promptTotal} reflection questions first, then score ${Math.round(pass.required * 100)}% on the game.`
            : `Reflection ${reflectionCount}/${promptTotal}, then score ${Math.round(pass.required * 100)}% on the game.`
        }
        done={unlocked('explanation')}
        open={open === 'explanation'}
        onToggle={() => toggle('explanation')}
      >
        {/* Reflection done but threshold not met: the card opens onto the progress meter, so the
            learner can see exactly how close they are and jump straight back to the game. */}
        {unlocked('explanation') ? (
          <Explanation topic={topic} />
        ) : (
          <ExplanationLocked
            best={pass.best}
            required={pass.required}
            attempts={pass.attempts}
            onRetry={() => setOpen('minigame')}
          />
        )}
      </PartCard>

    </section>
  )
}
