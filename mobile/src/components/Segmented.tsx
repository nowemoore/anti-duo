import SegmentedControl from '@react-native-segmented-control/segmented-control'
import { useColors } from '../hooks/theme'

/**
 * A two-or-more-way switch — the platform's own (`UISegmentedControl` on iOS, faithful recreations
 * on Android and web), tinted to the palette.
 *
 * `appearance="dark"` because the app has one theme and it's dark; the control otherwise picks up
 * the OS setting and a light segmented bar on our ground looks like a rendering bug.
 *
 * Deliberately no `backgroundColor`: passing one paints the control's layer as a plain square,
 * because UISegmentedControl's rounded track is part of the background it comes with rather than a
 * corner radius applied over whatever colour you hand it. `appearance` alone gives the right track.
 *
 * The selected segment takes the lavender, like the selected tab and the progress bars. Which half
 * of a switch you are on is a statement about where you are, not something to act on — the accent
 * stays with the things you press.
 */
export function Segmented({
  values,
  index,
  onChange,
  style,
}: {
  values: string[]
  index: number
  onChange: (next: number) => void
  style?: React.ComponentProps<typeof SegmentedControl>['style']
}) {
  const colors = useColors()
  return (
    <SegmentedControl
      values={values}
      selectedIndex={index}
      onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
      appearance="dark"
      tintColor={colors.highlight}
      fontStyle={{ color: colors.muted }}
      activeFontStyle={{ color: colors.ink, fontWeight: '600' }}
      style={style}
    />
  )
}
