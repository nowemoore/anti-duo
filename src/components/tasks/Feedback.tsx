import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface Props {
  correct: boolean
  detail?: string
}

export function Feedback({ correct, detail }: Props) {
  return (
    <div className={`feedback ${correct ? 'ok' : 'bad'}`} role="status">
      <FontAwesomeIcon icon={correct ? 'circle-check' : 'circle-xmark'} />
      <span>{correct ? 'Correct!' : 'Not quite.'}</span>
      {detail && <span className="detail">{detail}</span>}
    </div>
  )
}
