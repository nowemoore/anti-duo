import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { useColors } from '../hooks/theme'

/** Thin wrapper over RN FontAwesome: name looked up from the library (see src/icons.ts). */
export function Icon({
  name,
  size = 16,
  color,
}: {
  name: IconName
  size?: number
  color?: string
}) {
  const colors = useColors()
  return <FontAwesomeIcon icon={name} size={size} color={color ?? colors.ink} />
}
