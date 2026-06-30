# Anti-Duo — Japanese Kanji Learning App 明

A focused web app for learning and practising kanji — the calm, no-streaks-no-gimmicks answer to
Duolingo. You **Learn** kanji in small batches with real example words, then **Practice** them in
context with example sentences. Currently teaches **137 kanji** across **298 example sentences**.

The same codebase runs two ways:

- **Online demo** — a browser-only build hosted on GitHub Pages. No install, no account; progress is
  saved in your browser.
- **Locally** — the full app with a small Express backend that stores progress in a file on disk.
  This is what you get when you clone the repo.

---

## 1. What the app does

Three tabs:

### 勉強 Study — the core loop

Two independent actions, available any time:

- **Learn** introduces 5 new kanji at a time (random, from your enabled set), showing each
  character's meanings and example words, with a radical/component breakdown. Hold the eye icon to
  reveal a meaning.
- **Practice** runs 10 randomly chosen tasks over the kanji you've learned. There are five task
  types, one per iteration:

  | Task | You're shown… | …and you |
  | --- | --- | --- |
  | **Type the word** | an example word in kanji | type its reading in kana |
  | **Which words** | a kanji + 4 candidate words | multi-select the real ones (vs. fakes) |
  | **Fill the blank** (cloze) | a sentence with one kanji blanked | pick the right kanji from 4 options |
  | **Pick the reading** | a sentence with a word highlighted | choose its correct reading |
  | **Pick the meaning** | a sentence with a word highlighted | choose its correct English meaning |

Each kanji has a **level**: `0` = unseen → `1` on introduction → it moves up on correct answers and
down on misses. If a kanji drops below `1` it becomes "unlearned" again and is re-taught by a future
Learn round. Practice is weighted toward your lowest-level kanji to keep them even. In sentences, a
word shows in English until you've learned ≥1 of its kanji, then in Japanese (reading + meaning
revealed on hover).

### 設定 Settings

Set your display name, and toggle whole categories (Numbers, Food & Drink, …) or individual kanji
on/off — a disabled kanji keeps its progress but is paused from Learn and Practice.

### 使い方 Manual

A built-in usage guide.

**Tech:** React 18 + TypeScript + Vite front end. Kanji and sentence content lives in CSV files
under [`dbs/`](dbs/), parsed by a thin Express server behind a swappable storage interface.

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
