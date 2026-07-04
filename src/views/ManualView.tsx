import type { ReactNode } from 'react'
import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { SpeakButton } from '../components/SpeakButton'

/**
 * The "Manual" tab: a static, illustrated guide to how the app works. The task demos reuse the
 * real quiz CSS classes (and the working SpeakButton) so they look exactly like the live tasks,
 * shown in their already-answered state (green = the correct answer).
 */
export default function ManualView() {
  return (
    <div className="manual-page">
      <h1 className="manual-title">How to Use This Tool</h1>

      <section className="panel manual-about">
        <h2>About</h2>
        <p>
          Anti-Duo helps you learn kanji and lock them in with quick practice. Everything happens
          from the <strong>Study</strong> tab in two moves:
        </p>
        <ol className="manual-flow">
          <li>
            <strong>Learn</strong> <UiIcon icon="graduation-cap" />: introduces 5 new kanji at a
            time. For each one you get its meaning, real example contexts, and a breakdown of its
            radical + parts (open the magnifying glass <UiIcon icon="magnifying-glass" />).
          </li>
          <li>
            <strong>Practice</strong> <UiIcon icon="dumbbell" />: quizzes you on the kanji
            you&apos;ve already unlocked, mixing the question types below. Answer correctly and a
            kanji levels up; miss it and it comes back around.
          </li>
        </ol>
      </section>

      <section className="panel manual-tasks">
        <h2>Task Types</h2>
        <p className="muted">
          Practice rotates through these five question types. After each task, the correct answer
          shows up in green. On some tasks, you can hover or hold different parts of the question (the
          kanji or options) to view the reading, or tap the <UiIcon icon="volume-high" /> to hear it read aloud. On
          others, more information becomes available after you answer. You'll encounter the following tasks:
        </p>

        <ManualTask
          n={1}
          title="Type the reading"
          desc={
            <>
              You're presented with a word. Your task is to type its reading in hiragana — you can
              type romaji and it converts to kana as you go. After you answer, the <UiIcon icon="volume-high" />{' '}
              reads it aloud and the meaning appears.
            </>
          }
        >
          <div className="task type-word">
            <div className="prompt-word">
              日本
              <SpeakButton text="にほん" label="Play 日本" className="prompt-speak" />
            </div>
            <input className="kana-input" value="にほん" readOnly aria-label="your answer" />
            <div className="feedback ok" role="status">
              <FontAwesomeIcon icon="circle-check" />
              <span>Correct!</span>
              <span className="detail">日本 · Japan</span>
            </div>
          </div>
        </ManualTask>

        <ManualTask
          n={2}
          title="Which words are real"
          desc={
            <>
              You see one kanji and four words; select those that use the kanji correctly. After you answer, the real words turn green, and you can hover or hold
              one for its reading and meaning or tap the <UiIcon icon="volume-high" /> to hear it.
            </>
          }
        >
          <div className="task which-words">
            <div className="prompt-kanji">日</div>
            <ul className="option-grid">
              <RealWord word="日本" gloss="にほん · Japan" />
              <RealWord word="今日" gloss="きょう · today" />
              <FakeWord word="日車" />
              <FakeWord word="水日" />
            </ul>
            <p className="manual-demo-note">Green = the real words.</p>
          </div>
        </ManualTask>

        <ManualTask
          n={3}
          title="Fill in the kanji"
          desc="A sentence is missing one kanji (the reading stays above the blank to help you out). Pick the kanji that belongs there."
        >
          <div className="task choice">
            <div className="task-sentence">
              <span className="sentence">
                <span className="tok content word cloze">
                  <ruby>
                    <span className="cloze-blank" aria-label="blank" />
                    <rt>みず</rt>
                  </ruby>
                </span>
                <span className="tok scaffold">です。</span>
              </span>
            </div>
            <ul className="option-grid cloze-options">
              <ChoiceOpt label="水" correct />
              <ChoiceOpt label="火" />
              <ChoiceOpt label="木" />
              <ChoiceOpt label="金" />
            </ul>
          </div>
        </ManualTask>

        <ManualTask
          n={4}
          title="Pick the reading"
          desc={
            <>
              One word in the sentence is highlighted. Choose the correct reading for this word. You may tap
              the <UiIcon icon="volume-high" /> icon to listen to each option to help you decide.
            </>
          }
        >
          <div className="task choice">
            <div className="task-sentence">
              <span className="sentence">
                <span className="tok content highlight word jp">山</span>
                <span className="tok scaffold">が</span>
                <span className="tok content word jp">たかい</span>
                <span className="tok scaffold">。</span>
              </span>
            </div>
            <ul className="option-grid">
              <ReadingOpt label="やま" correct />
              <ReadingOpt label="かわ" />
              <ReadingOpt label="みず" />
              <ReadingOpt label="つき" />
            </ul>
          </div>
        </ManualTask>

        <ManualTask
          n={5}
          title="Pick the meaning"
          desc="One kanji in the sentence is highlighted. Choose the kanji's meaning."
        >
          <div className="task choice">
            <div className="task-sentence">
              <span className="sentence">
                <span className="tok content highlight word jp">犬</span>
                <span className="tok scaffold">が</span>
                <span className="tok content word jp">いる</span>
                <span className="tok scaffold">。</span>
              </span>
            </div>
            <ul className="option-grid">
              <ChoiceOpt label="dog" correct />
              <ChoiceOpt label="cat" />
              <ChoiceOpt label="bird" />
              <ChoiceOpt label="fish" />
            </ul>
          </div>
        </ManualTask>
      </section>

      <section className="panel manual-personalise">
        <h2>Personalise Your Experience</h2>
        <ul className="manual-points">
          <li>
            <strong>Pick your kanji.</strong> In <strong>Settings</strong> <UiIcon icon="gear" /> →{' '}
            <strong>Your learning</strong>, switch whole categories on or off, or expand one to
            toggle individual kanji to decide what you want to learn/practice.
          </li>
          <li>
            <strong>Set your name.</strong> In <strong>Settings</strong> <UiIcon icon="gear" /> →{' '}
            <strong>Profile</strong>, so the home screen can greet you.
          </li>
          <li>
            <strong>Hiragana chart.</strong> Tap <UiIcon icon="circle-question" /> in the top-left
            corner any time for a kana reference.
          </li>
          <li>
            <strong>Start over.</strong> Use <strong>reset progress</strong>{' '}
            <UiIcon icon="trash-can" /> under the welcome message on the Study home to clear your
            unlocked kanji and levels (your name and kanji selection are kept).
          </li>
        </ul>
      </section>

      <section className="panel manual-help">
        <h2>
          <FontAwesomeIcon icon="envelope" /> Want to help make the tool better?
        </h2>
        <p>
          Found a bug or think something could run better? Email{' '}
          <a className="manual-mail" href="mailto:nowe.moore@gmail.com">
            nowe.moore@gmail.com
          </a>{' '}
          (include details such as what happened, what you expected, which kanji or task it was on, screenshots, etc. if applicable).
          Thank you!
        </p>
      </section>
    </div>
  )
}

/** A small round icon chip for inline references to a control or tab (matches the task speaker). */
function UiIcon({ icon }: { icon: IconProp }) {
  return (
    <span className="inline-icon" aria-hidden="true">
      <FontAwesomeIcon icon={icon} />
    </span>
  )
}

interface ManualTaskProps {
  n: number
  title: string
  desc: ReactNode
  children: ReactNode
}

function ManualTask({ n, title, desc, children }: ManualTaskProps) {
  return (
    <article className="manual-task">
      <header className="manual-task-head">
        <span className="manual-task-no">{n}</span>
        <div>
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
      </header>
      <div className="manual-demo">{children}</div>
    </article>
  )
}

/** A correct word cell in the which-words demo (green, with reading · meaning). */
function RealWord({ word, gloss }: { word: string; gloss: string }) {
  return (
    <li className="opt-cell">
      <button type="button" className="opt reveal-correct" disabled>
        <span className="opt-word">{word}</span>
        <span className="opt-reading">{gloss}</span>
      </button>
    </li>
  )
}

/** A made-up (unselected) word cell in the which-words demo. */
function FakeWord({ word }: { word: string }) {
  return (
    <li className="opt-cell">
      <button type="button" className="opt" disabled>
        <span className="opt-word">{word}</span>
      </button>
    </li>
  )
}

/** A single-choice option (cloze / pick-meaning), green when correct. */
function ChoiceOpt({ label, correct }: { label: string; correct?: boolean }) {
  return (
    <li className="opt-cell">
      <button type="button" className={`opt${correct ? ' reveal-correct' : ''}`} disabled>
        {label}
      </button>
    </li>
  )
}

/** A pick-reading option: a reading plus a working speaker, green when correct. */
function ReadingOpt({ label, correct }: { label: string; correct?: boolean }) {
  return (
    <li className="opt-cell">
      <button type="button" className={`opt${correct ? ' reveal-correct' : ''}`} disabled>
        {label}
      </button>
      <SpeakButton text={label} label={`Play ${label}`} className="opt-speak" />
    </li>
  )
}
