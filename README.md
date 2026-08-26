# Anti-Duo — Japanese Kanji Learning App 明

A focused web app for learning Japanese — the calm, no-streaks-no-gimmicks answer to Duolingo.
Three courses, none of them gating the others: **kanji** (learn in small batches with real example
words, then practise them in context), **kana** (hiragana and katakana from the chart up), and
**grammar** (work the pattern out yourself before you're told the rule).

The same codebase runs two ways:

- **Online demo** — a browser-only build hosted on GitHub Pages. No install, no account; progress is
  saved in your browser.
- **Locally** — the full app with a small Express backend that stores progress in a file on disk.
  This is what you get when you clone the repo.

---

## 1. What the app does

Three tabs:

### 勉強 Study — three courses

The Study home is one card per course. Each is independent: a learner can start with any of them on
day one.

**漢字 Kanji** opens on the board — every kanji in your enabled set as a tile, shaded by how solid it
is. Click a tile to study that one; hold it (or right-click) to pause it. Above the board sit the two
"choose for me" actions:

- **Learn** introduces 5 new kanji at a time (random, from your enabled set), showing each
  character's meanings and example words, with a radical/component breakdown. Hold the eye icon to
  reveal a meaning. On a touchscreen or with a stylus, each card is followed by **writing** that
  character on the canvas — traced over a guide where the recogniser has no reference pattern, graded
  on-device where it has. Low-stakes: writing never moves your levels. Devices with only a mouse skip
  it, and don't get the handwriting practice task either — see below.
- **Practice** runs 10 randomly chosen tasks over the kanji you've learned. There are six task
  types, one per iteration (five on a device with no touchscreen or stylus — handwriting is only
  ever asked for where there's something to write with):

  | Task | You're shown… | …and you |
  | --- | --- | --- |
  | **Type the word** | an example word in kanji | type its reading in kana |
  | **Which words** | a kanji + 4 candidate words | multi-select the real ones (vs. fakes) |
  | **Fill the blank** (cloze) | a sentence with one kanji blanked | pick the right kanji from 4 options |
  | **Pick the reading** | a sentence with a word highlighted | choose its correct reading |
  | **Pick the meaning** | a sentence with a word highlighted | choose its correct English meaning |
  | **Write the word** _(touch/stylus only)_ | a word's reading | write it by hand; the strokes are matched on-device |

**かな Kana** is the script course: the charts *are* the curriculum. Open any character to hear it,
trace it and write it from memory (available on any device — it's something you choose to open),
then practise what you've met by ear: multiple choice, promoted to write-from-memory once a
character is solid and there's a touchscreen or stylus to write with. Words practice comes next, on the same
characters in real vocabulary.

**文法 Grammar** is a set of short subsections, each in four parts that unlock in order: the
vocabulary, a binary-choice game where you derive the pattern yourself, four free-writing questions
about what you noticed, and — only after you've written your own account *and* cleared the accuracy
bar — the official explanation. Passing a subsection credits the kanji in its vocabulary as learned.

Each kanji has a **level**: `0` = unseen → `1` on introduction → it moves up on correct answers and
down on misses. If a kanji drops below `1` it becomes "unlearned" again and is re-taught by a future
Learn round. Practice is weighted toward your lowest-level kanji to keep them even. In sentences, a
word shows in English until you've learned ≥1 of its kanji, then in Japanese (reading + meaning
revealed on hover).

### 統計 Stats

Vocabulary you've shown you know (open the card for the full word list and each word's run), plus a
success rate per task type.

### 設定 Settings

Set your display name, sign in for cloud backup (below), toggle whole categories (Numbers, Food &
Drink, …) or individual kanji on/off — a disabled kanji keeps its progress but is paused from Learn
and Practice — and tune how often each practice question type comes up.

#### Cloud backup (optional)

Off unless you configure it, and the app is fully usable without it. With a Supabase project wired
up, **Settings → Cloud backup** signs you in with a one-time code emailed to you (no password), and
your progress is backed up and shared with the phone app.

1. Run [`supabase/progress.sql`](supabase/progress.sql) in your project's SQL editor — it creates the
   `progress` table and the row-level security policies that keep one learner out of another's data.
2. Copy [`.env.example`](.env.example) to `.env.local` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` from Supabase → Project Settings → API. Restart the dev server.
3. For the deployed demo, the same values come from the repo's `EXPO_PUBLIC_SUPABASE_*` Actions
   secrets (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) — the phone app's
   PWA build already uses them.

The anon key is *publishable*: it ships inside every client build by design, so RLS is what protects
your data, not secrecy. Reconciliation is last-write-wins on a client revision number — fine for one
person across devices, but two devices edited while both were offline will not merge field by field:
whichever syncs last wins wholesale.

**Tech:** React 18 + TypeScript + Vite front end. Kanji and sentence content lives in CSV files
under [`dbs/`](dbs/), parsed by a thin Express server behind a swappable storage interface. The
handwriting recogniser and its reference patterns live in [`src/lib/handwriting/`](src/lib/handwriting/)
and are loaded on demand, so they cost nothing until you write something. The phone app in
[`mobile/`](mobile/) vendors [`src/lib/`](src/lib/) and [`shared/`](shared/), so both clients run the
same logic.

---

## 2. Using it online (the demo)

> **▶ Live demo:** `https://<your-username>.github.io/anti-duo/`
> _(replace `<your-username>`; the URL is `https://<owner>.github.io/<repo>/`)_

Open the link and start studying — it's a real, fully usable build, not a screenshot.

**Caveats** — the online demo runs entirely in your browser, with no backend:

- **Progress is per-browser.** It's kept in your browser's `localStorage`, on that one device. It
  does **not** sync between phone and laptop, or between different browsers.
- **Clearing your browser data wipes it.** Private/incognito windows start fresh and forget
  everything when closed. (Safari may also evict `localStorage` after ~7 idle days.)
- **Content is a snapshot.** The kanji/sentence data is baked in at deploy time and refreshes
  automatically on each redeploy.
- **Nothing leaves your device** — there's no server to send anything to.

Want progress that follows you across devices? Run it locally (below), or open an issue — a synced
backend is a clean follow-on.

### Deploy your own copy

The included GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) builds and publishes the demo on
every push to `main`:

1. Push this repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main` (or run the workflow from the **Actions** tab). Your site appears at
   `https://<owner>.github.io/<repo>/`.

The workflow sets the site's base path to your repo name automatically, so any repo name works.

---

## 3. Running it locally (full version)

The complete app, with progress saved to a file on your machine.

### Prerequisites

- **Node.js 18.18+** (Node 20 recommended — see [`.nvmrc`](.nvmrc))
- **npm** (ships with Node)

### Setup

```bash
git clone https://github.com/<owner>/anti-duo.git
cd anti-duo
npm install
npm run dev
```

Then open **http://localhost:5173**.

`npm run dev` runs two processes concurrently: the Vite dev server (port 5173) and the Express
backend (port 3001); the client proxies `/api` to the backend. Your progress is saved to
`data/progress.json` (created on first run, ignored by git).

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run client (Vite) + server (Express) together — local development |
| `npm run build` | Type-check and build the server-backed client into `dist/` |
| `npm run build:static` | Build the no-backend demo (what GitHub Pages deploys) |
| `npm run preview:static` | Preview the built static demo locally |
| `npm run gen:content` | Regenerate `public/content.json` from the CSVs |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run check` | Run all content/study/task validation checks |
| `npm run reset` | Delete saved progress (`data/progress.json`) |

---

## How the two builds differ

Both share one codebase; only the data layer in [`src/lib/api.ts`](src/lib/api.ts) changes, selected
at build time by the `VITE_STATIC` flag.

| | Local (`npm run dev`) | Online demo (`build:static`) |
| --- | --- | --- |
| Content | Express parses `dbs/*.csv` live | Pre-built `content.json`, fetched as a static asset |
| Progress | `data/progress.json` on disk | Browser `localStorage` |
| Needs a server | Yes (Express on :3001) | No — pure static files |

The `server/` directory and CSV data ship with the repo for the local version; the GitHub Pages
deploy never uses them.

## Data

- `dbs/kanji.csv`, `dbs/sentences.csv`, `dbs/allkanji_meanings.csv` — read-only content (authored
  offline).
- `data/progress.json` — per-user state (settings + per-kanji `lvl`), created on first run.
- `public/content.json` — generated snapshot for the static demo (`npm run gen:content`).
