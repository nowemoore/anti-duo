// Verifies task success-rate tracking — `npm run check:stats`.
// Each answered task earns (delta+1)/2 of 1 possible point; the rate is earned ÷ attempts.
import { earnedPoints, recordTaskResult, taskRates } from '../src/lib/stats'
import { normalizeProgress } from '../shared/progress'
import { defaultProgress } from '../shared/constants'
import type { Progress } from '../shared/types'

function rateOf(p: Progress, type: string): number | null {
  return taskRates(p).find((r) => r.type === type)?.rate ?? null
}

async function main() {
  // earnedPoints maps the [-1,+1] delta scale to [0,1] and clamps out-of-range input.
  const pointsOk =
    earnedPoints(1) === 1 &&
    earnedPoints(-1) === 0 &&
    earnedPoints(0) === 0.5 &&
    earnedPoints(0.5) === 0.75 &&
    earnedPoints(2) === 1 &&
    earnedPoints(-9) === 0

  // Binary task: 4 correct (+1) + 1 wrong (-1) → 4 points / 5 attempts = 0.8, i.e. fraction correct.
  let p = defaultProgress()
  for (const d of [1, 1, 1, 1, -1]) p = recordTaskResult(p, 'cloze', d)
  const clozeRow = taskRates(p).find((r) => r.type === 'cloze')!
  const binaryIsFractionCorrect = clozeRow.attempts === 5 && clozeRow.rate === 0.8

  // which-words partial credit: net +0.5 → 0.75 earned, net -0.5 → 0.25 earned; mean = 0.5.
  p = recordTaskResult(p, 'which-words', 0.5)
  p = recordTaskResult(p, 'which-words', -0.5)
  const partialCredit = rateOf(p, 'which-words') === 0.5

  // A net-zero which-words still counts as an attempt (worth 0.5 points).
  p = recordTaskResult(p, 'which-words', 0)
  const ww = taskRates(p).find((r) => r.type === 'which-words')!
  const zeroCounts = ww.attempts === 3 && Math.abs(ww.rate! - (0.75 + 0.25 + 0.5) / 3) < 1e-9

  // Untouched task types report null (not 0%).
  const untouchedNull = rateOf(defaultProgress(), 'type-word') === null

  // Round-trips through normalizeProgress; malformed entries are dropped.
  const dirty = {
    ...defaultProgress(),
    stats: { cloze: { attempts: 3, points: 2 }, junk: { attempts: 'x' }, bad: null },
  } as unknown as Progress
  const cleaned = normalizeProgress(dirty)
  const normalizeOk =
    cleaned.stats?.cloze?.attempts === 3 &&
    cleaned.stats?.cloze?.points === 2 &&
    !('junk' in (cleaned.stats ?? {})) &&
    !('bad' in (cleaned.stats ?? {}))

  const checks: [string, boolean][] = [
    ['earnedPoints maps/clamps the delta scale', pointsOk],
    ['binary rate = fraction correct (0.8 for 4/5)', binaryIsFractionCorrect],
    ['which-words scores per-option partial credit', partialCredit],
    ['net-zero answer still counts as an attempt', zeroCounts],
    ['untouched task type reports null', untouchedNull],
    ['stats round-trip; malformed entries dropped', normalizeOk],
  ]

  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: stats tracking correct' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
