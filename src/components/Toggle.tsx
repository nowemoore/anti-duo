interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  /** When true the control is shown but not interactive (e.g. would disable the last kanji). */
  disabled?: boolean
  label?: string
}

/** A small slider switch. */
export function Toggle({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle${checked ? ' on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  )
}
