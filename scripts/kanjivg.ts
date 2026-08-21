/**
 * KanjiVG → recognizer patterns. Shared by the generator (gen-kanjivg-patterns.ts) and the
 * validator (check-handwriting.ts); no side effects on import.
 *
 * KanjiVG (http://kanjivg.tagaini.net) is © Ulrich Apel, CC BY-SA 3.0.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import KanjiCanvasRaw from '../mobile/src/lang/ja/handwriting/kanjicanvas'

/* eslint-disable @typescript-eslint/no-explicit-any */
// Metro unwraps the CJS default export; tsx leaves it nested one level. Accept either so the
// generator and the app drive the exact same recognizer object.
export const KC: any = (KanjiCanvasRaw as any)?.momentNormalize
  ? KanjiCanvasRaw
  : ((KanjiCanvasRaw as any)?.default ?? KanjiCanvasRaw)

export type Point = [number, number]

/** KanjiVG's canvas is 109×109; the recognizer works around 256. */
const KVG_SIZE = 109
const TARGET = 256
const BASE = 'https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji'

export const CACHE = process.env.KANJIVG_CACHE ?? join(process.cwd(), '.cache/kanjivg')

// ---------------------------------------------------------------------------
// SVG path → polyline
// ---------------------------------------------------------------------------

/** Split a `d` attribute into [command, numbers] pairs. */
function parsePath(d: string): [string, number[]][] {
  const out: [string, number[]][] = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number)
    out.push([m[1], nums])
  }
  return out
}

const cubic = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const e = t * t * t
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1],
  ]
}

const dist = (a: Point, b: Point): number => Math.hypot(b[0] - a[0], b[1] - a[1])

/** Samples enough points that extractFeatures has a smooth curve to resample from. */
function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, out: Point[]): void {
  const rough = dist(p0, p1) + dist(p1, p2) + dist(p2, p3)
  const steps = Math.max(4, Math.min(24, Math.ceil(rough / 2)))
  for (let i = 1; i <= steps; i++) out.push(cubic(p0, p1, p2, p3, i / steps))
}

/**
 * Flatten one stroke's path into a dense polyline. Handles every command KanjiVG uses (M/L/H/V/C/S
 * and their relative forms); Q/T are supported too, and the elliptical arc A — which KanjiVG does
 * not use — degrades to a straight line to the endpoint rather than throwing.
 */
export function flatten(d: string): Point[] {
  const pts: Point[] = []
  let cur: Point = [0, 0]
  let start: Point = [0, 0]
  let lastCtrl: Point | null = null

  for (const [cmd, n] of parsePath(d)) {
    const rel = cmd === cmd.toLowerCase()
    const abs = (x: number, y: number): Point => (rel ? [cur[0] + x, cur[1] + y] : [x, y])
    const up = cmd.toUpperCase()

    if (up === 'Z') {
      pts.push(start)
      cur = start
      lastCtrl = null
      continue
    }
    // Each command may carry repeated coordinate groups (e.g. "C" with 12 numbers = two curves).
    const stride = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[up] ?? 2
    for (let i = 0; i + stride <= n.length; i += stride) {
      const a = n.slice(i, i + stride)
      switch (up) {
        case 'M': {
          cur = abs(a[0], a[1])
          if (i === 0) start = cur
          pts.push(cur)
          lastCtrl = null
          break
        }
        case 'L': {
          cur = abs(a[0], a[1])
          pts.push(cur)
          lastCtrl = null
          break
        }
        case 'H': {
          cur = [rel ? cur[0] + a[0] : a[0], cur[1]]
          pts.push(cur)
          lastCtrl = null
          break
        }
        case 'V': {
          cur = [cur[0], rel ? cur[1] + a[0] : a[0]]
          pts.push(cur)
          lastCtrl = null
          break
        }
        case 'C': {
          const c1 = abs(a[0], a[1])
          const c2 = abs(a[2], a[3])
          const end = abs(a[4], a[5])
          sampleCubic(cur, c1, c2, end, pts)
          lastCtrl = c2
          cur = end
          break
        }
        case 'S': {
          // Reflect the previous control point; with no previous curve the current point is used.
          const c1: Point = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur
          const c2 = abs(a[0], a[1])
          const end = abs(a[2], a[3])
          sampleCubic(cur, c1, c2, end, pts)
          lastCtrl = c2
          cur = end
          break
        }
        case 'Q': {
          const q = abs(a[0], a[1])
          const end = abs(a[2], a[3])
          // Raise the quadratic to an equivalent cubic so one sampler covers both.
          const c1: Point = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])]
          const c2: Point = [end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1])]
          sampleCubic(cur, c1, c2, end, pts)
          lastCtrl = q
          cur = end
          break
        }
        case 'T': {
          const q: Point = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur
          const end = abs(a[0], a[1])
          const c1: Point = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])]
          const c2: Point = [end[0] + (2 / 3) * (q[0] - end[0]), end[1] + (2 / 3) * (q[1] - end[1])]
          sampleCubic(cur, c1, c2, end, pts)
          lastCtrl = q
          cur = end
          break
        }
        default: {
          // 'A' — unused by KanjiVG; take the endpoint so a stray arc can't derail a stroke.
          cur = abs(a[5], a[6])
          pts.push(cur)
          lastCtrl = null
        }
      }
    }
  }
  return pts
}

/** Stroke paths in drawing order — KanjiVG writes them in stroke order. */
export function strokesOf(svg: string): Point[][] {
  const scale = TARGET / KVG_SIZE
  const out: Point[][] = []
  const re = /<path[^>]*\sd="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg)) !== null) {
    const pts = flatten(m[1]).map(([x, y]): Point => [x * scale, y * scale])
    if (pts.length >= 2) out.push(pts)
  }
  return out
}

// ---------------------------------------------------------------------------
// Fetching + conversion
// ---------------------------------------------------------------------------

const fileFor = (char: string): string =>
  `0${char.codePointAt(0)!.toString(16).padStart(4, '0')}.svg`

/** Cached fetch. `offline` returns null instead of hitting the network on a cache miss. */
export async function svgFor(char: string, offline = false): Promise<string | null> {
  mkdirSync(CACHE, { recursive: true })
  const name = fileFor(char)
  const path = join(CACHE, name)
  if (existsSync(path)) return readFileSync(path, 'utf8')
  if (offline) return null
  const res = await fetch(`${BASE}/${name}`)
  if (!res.ok) return null
  const text = await res.text()
  writeFileSync(path, text)
  return text
}

/**
 * Run strokes through the recognizer's *own* momentNormalize + extractFeatures, so generated
 * patterns land in exactly the same feature space as the recorded ones rather than in a space that
 * merely looks similar.
 */
export function featuresFor(strokes: Point[][]): Point[][] {
  KC['recordedPattern_gen'] = strokes
  const normalized = KC.momentNormalize('gen')
  return KC.extractFeatures(normalized, 20) as Point[][]
}

/** Bounded concurrency — a few hundred tiny files, but no reason to hammer the host. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}
