import { useState } from 'react'
import { Modal, View, Text, ScrollView, StyleSheet, useColorScheme } from 'react-native'
import { useLanguage } from '../context/LanguageContext'
import { TapScale } from './TapScale'
import { edge, fonts, radius, spacing, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/**
 * Hold to reveal the active language's script reference, release to hide it.
 *
 * Says what it does, in words, with no glyph. A question mark in a header is a guess — settings? a
 * tutorial? an about box? — and the part no glyph can convey at all is that the chart has to be
 * *held* to stay up. Mid-question is exactly when a learner needs to know the aid is there, and
 * exactly when they won't go exploring to find out.
 */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  const styles = useStyles(makeStyles)
  /*
   * The colour is matched to the capsule iOS draws behind a bar button, not to the app's palette.
   *
   * That capsule is a system material and it flips with the *system* scheme, not with the app (which
   * is dark either way): in dark mode it is a light glass with a dark glyph on it — which is why the
   * back chevron opposite reads dark — and in light mode the reverse. Nothing exposes the glyph
   * colour the system picked, so this mirrors the rule instead. Palette ink was the bug: it is light
   * in both palettes, so on that light capsule the label washed out to nearly nothing.
   */
  const onCapsule = useColorScheme() === 'light' ? '#f2f2f2' : '#1c1c1e'
  const { reference } = useLanguage()
  if (!reference) return null // a language with no script chart hides the help button
  const { title, aid, Chart } = reference

  return (
    <>
      <TapScale
        style={styles.helpBtn}
        onPressIn={() => setOpen(true)}
        onPressOut={() => setOpen(false)}
        accessibilityLabel={`Hold to view ${aid}`}
        hitSlop={8}
      >
        <Text style={[styles.helpLabel, { color: onCapsule }]}>hold to view {aid}</Text>
      </TapScale>

      {/* pointerEvents: 'none' so the held label keeps the touch — releasing it hides the chart. */}
      <Modal visible={open} transparent animationType="fade">
        <View style={styles.backdrop} pointerEvents="none">
          <View style={styles.card}>
            <Text style={styles.hint}>hold to keep viewing</Text>
            <Text style={styles.title}>
              {title.native} <Text style={styles.sub}>{title.en}</Text>
            </Text>
            <ScrollView contentContainerStyle={styles.scroll}>
              <Chart />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  helpBtn: {
    alignItems: 'center',
    /*
     * The system capsule hugs this view, so this padding is the gap between the words and the glass
     * edge — at the default they sat hard against it. Sized to content rather than to a fixed 40pt
     * height: with a height set, the label centred inside it but the capsule did not, leaving more
     * air above the words than below.
     */
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  // Lower case, in the app's voice for a hint: it explains the control, it isn't a heading. The
  // colour is applied inline, matched to the system's capsule — see the label itself.
  // An explicit lineHeight, so the text's box is symmetric around the glyphs. Left to the font, the
  // ascent runs taller than the descent and the words sit low in their own line.
  helpLabel: { fontFamily: fonts.body, fontSize: 12, lineHeight: 14 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' },
  card: {
    backgroundColor: colors.overlay,
    borderColor: colors.overlayEdge,
    borderWidth: edge,
    borderRadius: radius.lg,
    padding: 12,
    maxWidth: 560,
    maxHeight: '92%',
    width: '100%',
  },
  hint: { position: 'absolute', top: 8, right: 12, fontSize: 10, color: colors.muted, fontFamily: fonts.body, zIndex: 1 },
  title: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 18, textAlign: 'left', marginBottom: 12 },
  sub: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  scroll: { flexGrow: 1, alignItems: 'flex-start' },
})
