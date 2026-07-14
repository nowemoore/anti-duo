import { View, Text, Pressable, StyleSheet } from 'react-native'
import { PACKS } from '../lang/registry'
import { useLanguage, useSetLanguage } from '../context/LanguageContext'
import { fonts, radius, type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/** Compact segmented language switch (native labels). Each language keeps its own progress + content. */
export function LanguageToggle() {
  const active = useLanguage().id
  const setLang = useSetLanguage()
  const styles = useStyles(makeStyles)
  const packs = Object.values(PACKS)
  if (packs.length < 2) return null

  return (
    <View style={styles.seg}>
      {packs.map((p) => {
        const on = p.id === active
        return (
          <Pressable
            key={p.id}
            onPress={() => !on && setLang(p.id)}
            style={[styles.item, on && styles.itemOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Switch to ${p.label.en}`}
          >
            {/* Native label on the system font — the bundled Latin fonts have no CJK/Arabic glyphs. */}
            <Text style={[styles.text, on && styles.textOn]}>{p.label.native}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  seg: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 2,
    padding: 3,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  item: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: radius.pill },
  itemOn: { backgroundColor: colors.accent },
  text: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  textOn: { color: colors.onAccent },
})
