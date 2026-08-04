import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import type { GrammarTopicProgress } from '@shared/types'
import { missedItems, type GrammarContext, type GrammarTopic } from '@lib/grammar'
import { Disclosure } from './PartCard'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** Idle delay before an in-progress answer is committed to storage. */
const SAVE_IDLE_MS = 800

/**
 * Part 3 — four free-writing prompts. Each answer is persisted separately (per topic, per question
 * id) with its own nullable `feedback` field, reserved for LLM review later; nothing generates
 * feedback today.
 */
export function Reflection({
  topic,
  tp,
  ctx,
  onSave,
}: {
  topic: GrammarTopic
  tp: GrammarTopicProgress
  /** Content + progress, used to resolve the recorded attempt's items back to their bank entries. */
  ctx: GrammarContext
  onSave: (questionId: string, answer: string) => void
}) {
  const styles = useStyles(makeStyles)
  const missed = missedItems(topic, tp, ctx)

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        No right answers here — write what you noticed. Your notes are saved as you type.
      </Text>

      {topic.reflection.prompts.map((p, n) => (
        <View key={p.id} style={styles.block}>
          <Text style={styles.prompt}>
            <Text style={styles.promptNum}>{n + 1}. </Text>
            {p.prompt}
          </Text>

          {p.showMissedItems && (
            <Disclosure label={`Your missed items (${missed.length})`}>
              {missed.length === 0 ? (
                <Text style={styles.missNone}>
                  Nothing missed in your last attempt — good sign, but the question still stands.
                </Text>
              ) : (
                missed.map(({ item, picked }) => (
                  <View key={item.id} style={styles.missRow}>
                    <Text style={styles.missVerb}>{item.form}</Text>
                    <Text style={styles.missPicked}>you picked {picked}</Text>
                  </View>
                ))
              )}
            </Disclosure>
          )}

          <AnswerField
            value={tp.reflections[p.id]?.answer ?? ''}
            onCommit={(text) => onSave(p.id, text)}
          />
        </View>
      ))}
    </View>
  )
}

/**
 * One textarea. Keeps the text in local state so typing never waits on a progress write, and commits
 * on idle plus on blur — the debounce alone would lose the tail if the part is collapsed mid-word.
 */
function AnswerField({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  const commit = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (pending.current != null) {
      onCommit(pending.current)
      pending.current = null
    }
  }

  // Flush whatever is still pending if the field goes away (part collapsed, section closed). Held in
  // a ref so the unmount effect never re-runs — re-running it would flush on every keystroke.
  const commitRef = useRef(commit)
  commitRef.current = commit
  useEffect(() => () => commitRef.current(), [])

  const change = (next: string) => {
    setText(next)
    pending.current = next
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(commit, SAVE_IDLE_MS)
  }

  return (
    <TextInput
      style={[styles.input, focused && styles.inputOn]}
      value={text}
      onChangeText={change}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        commit()
      }}
      multiline
      textAlignVertical="top"
      placeholder="Write your thoughts…"
      placeholderTextColor={colors.muted}
    />
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { gap: spacing.lg },
  intro: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, fontStyle: 'italic' },
  block: { gap: spacing.sm },
  prompt: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  promptNum: { fontFamily: fonts.semibold, color: colors.accentInk },
  input: {
    minHeight: 92,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: colors.panelStrong,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inputOn: { borderColor: colors.accent },
  missRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
  missVerb: { color: colors.ink, fontSize: 18, minWidth: 62 },
  missPicked: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 12 },
  missNone: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, fontStyle: 'italic' },
})
