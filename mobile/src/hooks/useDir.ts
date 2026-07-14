import { useLanguage } from '../context/LanguageContext'

/**
 * Text direction of the active language, for right-to-left scripts (Arabic). Text-level only — we
 * don't mirror the whole app (no I18nManager); components read this to flip sentence word order and
 * align/base-direct their own Arabic text. LTR languages get the no-op defaults.
 */
export function useDir(): {
  rtl: boolean
  writingDirection: 'rtl' | 'ltr'
  textAlign: 'right' | 'left'
} {
  const rtl = useLanguage().direction === 'rtl'
  return {
    rtl,
    writingDirection: rtl ? 'rtl' : 'ltr',
    textAlign: rtl ? 'right' : 'left',
  }
}
