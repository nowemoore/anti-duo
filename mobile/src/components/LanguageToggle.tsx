import { StyleSheet } from 'react-native'
import { Segmented } from './Segmented'
import { selectablePacks } from '../lang/registry'
import { useLanguage, useSetLanguage } from '../context/LanguageContext'

/** Compact segmented language switch (native labels). Each language keeps its own progress + content. */
export function LanguageToggle() {
  const active = useLanguage().id
  const setLang = useSetLanguage()
  // Hidden packs (see registry) are excluded, so this collapses to nothing when only one is offered.
  const packs = selectablePacks()
  if (packs.length < 2) return null

  const index = Math.max(0, packs.findIndex((p) => p.id === active))
  return (
    <Segmented
      // Native labels on the system font — the bundled Latin fonts have no CJK/Arabic glyphs.
      values={packs.map((p) => p.label.native)}
      index={index}
      onChange={(next) => {
        const picked = packs[next]
        if (picked && picked.id !== active) setLang(picked.id)
      }}
      style={styles.seg}
    />
  )
}

const styles = StyleSheet.create({
  // Narrow: two or three glyph-wide labels, centred rather than stretched across the screen.
  seg: { alignSelf: 'center', width: 180 },
})
