import { useState } from 'react'
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useLanguage } from '../context/LanguageContext'
import { Icon } from './Icon'
import { colors, fonts, radius } from '../theme'

/** "?" button: hold it to reveal the active language's script reference, release to hide it. */
export function HelpButton() {
  const [open, setOpen] = useState(false)
  const { reference } = useLanguage()
  if (!reference) return null // a language with no script chart hides the help button
  const { title, Chart } = reference

  return (
    <>
      <Pressable
        style={styles.helpBtn}
        onPressIn={() => setOpen(true)}
        onPressOut={() => setOpen(false)}
        accessibilityLabel={`Hold for ${title.en} chart`}
        hitSlop={8}
      >
        <Icon name="circle-question" size={30} color={colors.muted} />
      </Pressable>

      {/* pointerEvents: 'none' so the held "?" keeps the touch — releasing it hides the chart. */}
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

const styles = StyleSheet.create({
  helpBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' },
  card: {
    backgroundColor: '#4d4152',
    borderColor: '#6b5a70',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    maxWidth: 560,
    maxHeight: '86%',
    width: '100%',
  },
  hint: { position: 'absolute', top: 8, right: 12, fontSize: 10, color: colors.muted, fontFamily: fonts.body, zIndex: 1 },
  title: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 18, textAlign: 'left', marginBottom: 12 },
  sub: { fontSize: 12, color: colors.muted, fontFamily: fonts.body },
  scroll: { flexGrow: 1, alignItems: 'flex-start' },
})
