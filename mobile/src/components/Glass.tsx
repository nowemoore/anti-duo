import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import { type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/**
 * The app's glass kit. Everything frosted goes through here, so the material is defined once.
 *
 * `GlassView` is the real Liquid Glass material, not an imitation — and it's available in Expo Go,
 * so no development build is involved. Below iOS 26 (and on Android and web) the module degrades to
 * a plain view, which would leave a control with no ground at all; each surface here draws the
 * translucent fill and hairline edge the app used before instead.
 */
export function GlassSurface({
  tint,
  style,
  children,
}: {
  /** Colours the glass. Omitted → the plain system material. */
  tint?: string
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}) {
  const styles = useStyles(makeStyles)
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={style} glassEffectStyle="regular" tintColor={tint}>
        {children}
      </GlassView>
    )
  }
  // No glass to tint, so the tint becomes the fill outright.
  return <View style={[styles.fallback, tint ? { backgroundColor: tint } : null, style]}>{children}</View>
}

/**
 * The round glass well the system puts behind a navigation-bar button on iOS 26.
 *
 * Sized by the caller, since a bar button and a pager control aren't the same diameter but must
 * read as the same object.
 */
export function GlassCircle({
  size,
  tint,
  style,
  children,
}: {
  size: number
  tint?: string
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}) {
  const styles = useStyles(makeStyles)
  return (
    <GlassSurface tint={tint} style={[styles.centre, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {children}
    </GlassSurface>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fallback: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
})
