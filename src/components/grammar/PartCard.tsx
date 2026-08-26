import { useState, type ReactNode } from 'react'
import type { IconName } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/**
 * One collapsible part of a grammar subsection. Locked parts render dimmed with a padlock and their
 * unlock condition, and can't be expanded; unlocked ones stay expandable forever, so a finished part
 * is always revisitable.
 */
export function PartCard({
  step,
  icon,
  title,
  subtitle,
  locked,
  lockedHint,
  done,
  open,
  onToggle,
  children,
}: {
  /** 1-based part number, shown in the leading badge. */
  step: number
  icon: IconName
  title: string
  subtitle?: string
  locked: boolean
  /** Why it's locked — shown in place of the subtitle. */
  lockedHint?: string
  /** Ticks the badge once the part's own goal is met. */
  done?: boolean
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className={`part-card${locked ? ' locked' : ''}`}>
      <button
        type="button"
        className="part-head"
        onClick={locked ? undefined : onToggle}
        disabled={locked}
        aria-expanded={open}
        aria-label={`Part ${step}: ${title}${locked ? ', locked' : ''}`}
      >
        <span className={`part-badge${done ? ' done' : ''}${locked ? ' badge-locked' : ''}`}>
          {locked ? (
            <FontAwesomeIcon icon="lock" />
          ) : done ? (
            <FontAwesomeIcon icon="check" />
          ) : (
            step
          )}
        </span>

        <span className="part-head-text">
          <span className="part-title-row">
            <FontAwesomeIcon icon={icon} className="part-title-icon" />
            <span className="part-title">{title}</span>
          </span>
          {(locked ? lockedHint : subtitle) ? (
            <span className="part-sub">{locked ? lockedHint : subtitle}</span>
          ) : null}
        </span>

        {!locked && <FontAwesomeIcon icon="chevron-down" className={`part-chevron${open ? ' open' : ''}`} />}
      </button>

      {/* Animated open/close rather than an instant swap. Children stay mounted throughout, so
          collapsing a part mid-run never throws away answers already given — reopening puts you back
          exactly where you were. */}
      {!locked && (
        <div className={`part-collapse${open ? ' open' : ''}`} aria-hidden={!open}>
          <div className="part-collapse-inner">
            {/* `visibility: hidden` while collapsed (see .part-collapse) keeps the still-mounted
                children out of the tab order and off screen readers. */}
            <div className="part-body">{children}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Collapsed-by-default disclosure used inside parts (e.g. the missed-items reference). */
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="disclosure">
      <button type="button" className="disclosure-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <FontAwesomeIcon icon="chevron-down" className={`part-chevron${open ? ' open' : ''}`} />
        <span className="disclosure-label">{label}</span>
      </button>
      {open && <div className="disclosure-body">{children}</div>}
    </div>
  )
}
