import { View, StyleSheet } from 'react-native'
import { Icon } from './Icon'
import { spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

/**
 * The hand-off between a page's header and the board below it: a rule broken by three chevrons
 * pointing down.
 *
 * The three sit level and a little heavier than the rule — quiet enough to belong to the divider,
 * solid enough to be seen as arrows rather than as texture on the line. (A graded fade was tried and
 * reads wrong: the arrows run left to right while the motion they stand for is downward, so the
 * gradient pulled the eye sideways along the rule.)
 */
export function ScrollCue() {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.cue}>
      <View style={styles.cueLine} />
      <View style={styles.cueArrows}>
        {[0, 1, 2].map((i) => (
          <Icon key={i} name="chevron-down" size={12} color={colors.highlightSoft} />
        ))}
      </View>
      <View style={styles.cueLine} />
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  cue: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cueLine: { flex: 1, height: 1, backgroundColor: colors.border },
  // Stacked tight so the three read as one falling mark rather than three separate chevrons.
  cueArrows: { flexDirection: 'row', alignItems: 'center', gap: 2 },
})
