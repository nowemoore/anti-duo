import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { HiraganaTable } from './HiraganaTable'

/** Top-bar "?" button that opens a hiragana reference chart in a modal. */
export function HelpButton() {
  const [open, setOpen] = useState(false)

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="help-btn"
        aria-label="Hiragana chart"
        title="Hiragana chart"
        onClick={() => setOpen(true)}
      >
        <FontAwesomeIcon icon="circle-question" />
      </button>

      {open &&
        createPortal(
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label="Hiragana chart"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <FontAwesomeIcon icon="xmark" />
              </button>
              <h2 className="modal-title">
                ひらがな <span className="modal-sub">Hiragana</span>
              </h2>
              <HiraganaTable />
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
