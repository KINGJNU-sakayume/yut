# 모 아니면 도 (Yut Roguelike)

도깨비에게 진 빚을 **윷놀이**로 갚는 브라우저 로그라이크.
A browser roguelike built on Korean Yutnori: you owe a supernatural debt to goblins (도깨비)
and must repay it, board by board, with four Yut sticks.

> 운이 이동을 주지만, 그 운을 **어느 말에 투자할지**, 얼마나 많은 화물을 싣고 위험을 감수할지,
> 도깨비를 사냥할지, 업을지, 그리고 지금 **퇴근**할지 **한 바퀴 더** 돌지는 플레이어가 정한다.

- Static SPA — no backend, no database. Saves, unlocks and settings live in `localStorage`.
- Vite + React + TypeScript + Tailwind CSS; pure-TypeScript game engine tested with Vitest.
- Every random decision goes through a seeded RNG: `?seed=12345` reproduces a run.

---

## 핵심 루프 (Core loop)

**collect → grow → become exposed → get greedy → cash out or risk another lap → explode or lose the cargo**

1. **윷 던지기** — four individual sticks. Count the flat (배) faces: 1 도, 2 개, 3 걸, 4 윷, 0 모.
   A single flat face on the marked stick is **빽도** (−1). 윷 and 모 give a free extra throw.
2. **배정** — you choose which piece/stack receives each result (never automatic), and at forks
   (모, 뒷모, 방) you choose the route.
3. **화물 (cargo)** — every node you traverse pays cargo once per lap (normal 5, corner 15, center 30).
4. **기세 (momentum)** — the group that receives a result gains momentum (빽도 +2, 도 +1 … 모 +5).
5. **업기 (stacking)** — land on your own group to stack: cargo adds, momentum = max + 1,
   score ×1.5 / ×2.25 / ×4 for 2 / 3 / 4 pieces — and one goblin can take it all.
6. **도깨비** — goblins walk the board in reverse. Their next move (result, path, landing node)
   is **always shown** before you commit. A goblin landing on your group sends it home and
   takes its cargo; capture that goblin later to get it back (plus a free throw).
7. **참먹이 (goal)** — arriving never scores automatically. Choose **퇴근 (Cash Out)** or
   **한 바퀴 더 (One More Lap)**: ×1.5 → ×2.25 → ×4, with visible escalating danger
   (2nd extra lap spawns a goblin; 3rd makes every goblin move +1 while that group is out).

```
finalScore = cargo × momentum × stackMultiplier × lapMultiplier × otherFinalMultipliers
```

Score phases (each resolved left → right across talismans, then blessings):
1 additive cargo → 2 additive momentum → 3 cargo multipliers → 4 stack/lap multipliers →
5 final multipliers → 6 post-score effects. The cash-out screen shows every line.

### Run structure
- 8 마당 (Yards) × 3 boards (small, big, goblin boss) = 24 boards. Targets are in `src/data/targets.ts`.
- Before each board choose a wager: **안전** (15 throws, reward ×0.85), **보통** (12, ×1),
  **모 아니면 도** (9, ×1.3, +2 coins). Extra throws from 윷/모/captures never consume base throws.
- The board clears the moment the target is reached; it is lost when base throws run out.
- After every cleared board: a shop. After each big board: an event (성황당, 주막, 대장간, 노름판, 산신령).
  After the bosses of yards 2/4/6: the **도깨비 장터** (Goblin Market) — structural trades and cursed talismans.
- 7 bosses (외눈, 거꾸로, 외톨이, 욕심, 길막이, 엿장수, 붉은 탈); the rule is shown before the board starts.

### Content
- **49 talismans + 8 산신령 blessings**: 43 shop talismans across 도 / 개 / 걸 / 윷·모 / 빽도 / 업기 /
  사냥 / 길 / 한 바퀴 더 / 살림 archetypes (incl. legendaries 시간 역행, 만선) and 6 cursed talismans
  (피 묻은 방망이, 귀신 들린 윷, 황금 복주머니, 욕심쟁이 혹, 저승 명부, 모 아니면 죽음) whose downside is always displayed.
- 4 consumables (엿, 부채, 복주머니, 소금), 6 Yut-stick modifications, 6 piece traits.
- Meta progression with 도깨비불: unlocks content (talismans, cursed items, bosses, events, skins,
  debt levels), achievements, records and a compendium — no permanent stat inflation.

---

## 조작 (Controls)

| Action | How |
| --- | --- |
| Throw | **던지기** button or **Space** |
| Pick a result | click a result chip (when several are waiting) |
| Pick a piece | click a glowing piece on the board or in the 집 tray |
| Pick a route | click the gold destination ring on the board or a route button (with preview) |
| Reorder talismans | ◀ / ▶ buttons, ←/→ keys on a focused card, or drag & drop |
| Inspect | hover or focus any talisman, goblin intent, boss chip or stick |
| Menu | ☰ 메뉴 (rules, settings, save & exit, abandon run) |

Accessibility: threat cells use a hatched pattern, an ✕ mark and a text label (never colour only);
all controls are keyboard reachable; a **reduced-motion** setting (default follows the OS) removes animation.

### Rules worth knowing
- **Forks** are decided only when a move *starts* on 모 (o5), 뒷모 (o10) or 방 (center). Passing a
  corner mid-move keeps to the outer path; passing straight through the center keeps its line.
- **빽도** moves back along the group's own route for this lap (from 도 it returns home).
- **빽도 출발 (fallback)**: if no group can legally move backward (e.g. everyone is still at home),
  the Backdo is used as a one-step forward move by the group you choose. It still counts as a Backdo
  for momentum (+2) and for every talisman. A result can only be discarded if no legal move exists.
- A group can collect a node's base cargo only once per lap (talismans like 되짚기 may break this).

---

## Local development

```bash
npm install          # or: npm ci
npm run dev          # http://localhost:5173 (debug panel enabled in dev)
npm test             # Vitest, non-watch
npm run lint         # oxlint
npm run typecheck    # tsc -b
npm run build        # typecheck + production build into dist/
npm run preview      # serve dist/
npm run sim          # balance simulation with a heuristic bot (slow; prints score percentiles)
```

URL options: `?seed=12345` pre-fills the run seed, `?debug=1` shows the debug panel in production
builds (force next Yut result, add coins/talismans/consumables, set cargo/momentum, teleport,
spawn goblins, jump to boss, change target, add throws).

## Deploying to GitHub Pages

Two workflows live in `.github/workflows/`:

- **`ci.yml`** — on every push and pull request: `npm ci`, lint, typecheck, Vitest, build. Any failure fails CI.
  It never deploys.
- **`deploy-pages.yml`** — on push to `main` (or manual *Run workflow*): tests, build, upload `dist`,
  deploy with the official Pages actions, with `pages` concurrency protection.

One-time setup: **Repository → Settings → Pages → Build and deployment → Source: “GitHub Actions”.**

The app never assumes it is served from `/`. `vite.config.ts` resolves `base` as:
1. `VITE_BASE` if set (the Pages workflow passes `actions/configure-pages`' `base_path`),
2. inside GitHub Actions: `/` for a `USERNAME.github.io` repository, otherwise `/<repository>/`,
3. `/` locally.

There is no path routing (the game is a single-screen state machine), so no rewrite rules are needed.

## Saves, resume and reset

- The active run is saved to `localStorage` (`yut-roguelike:run`) after every state change; the title
  screen offers **이어하기** (continue) or **새 판 시작** (new run). ☰ 메뉴 → *이번 판 포기하기* abandons
  the run (with confirmation).
- Meta progression (도깨비불, unlocks, discoveries, achievements, records, settings) is stored in
  `yut-roguelike:meta`.
- Saves are versioned (`SAVE_VERSION` in `src/game/config.ts`). An incompatible or corrupt save is
  reported on the title screen with a delete button instead of crashing.
- Full reset: delete both keys in the browser devtools (Application → Local Storage) or clear site data.

---

## Architecture

```
src/
  game/                    pure TypeScript engine (no React)
    types.ts               state, actions, records
    config.ts              every tunable constant (wagers, multipliers, economy, goblins…)
    rng.ts                 seeded mulberry32 streams (throw / goblin per board, shop, event, run)
    yut.ts                 four-stick simulation, modifications, exact outcome distribution
    boardGraph.ts          standard Yut board graph (stable node ids, forward/reverse adjacency)
    movement.ts            path enumeration, forks, Backdo + fallback rule, trait legality
    ai/goblinIntent.ts     public goblin intents, deterministic paths, threat queries
    scoring.ts             phased cash-out computation and side-effect-free prediction
    board.ts               board state machine: throw, move, stack, capture, goal, goblin phase
    shop.ts, events.ts     shop/rerolls/selling, events and the Goblin Market
    run.ts                 run creation, boss schedule, board → event/shop → next board
    reducer.ts             (state, action) → state; rule violations return a `notice`
    selectors.ts           read-only views for the UI (legal moves, previews, odds…)
    meta.ts                meta progression (unlocks, achievements, records)
    save/saveManager.ts    versioned localStorage persistence
    effects/
      effectTypes.ts       hook names, hook contexts, effect params
      effectRegistry.ts    typed effect kinds (handlers per hook)
      effectEngine.ts      ordered dispatcher (slots left → right, then blessings)
    __tests__/             Vitest unit, interaction and fuzz tests
    __sim__/               heuristic bot + balance simulation
  data/                    content as data: talismans, bosses, consumables, yutMods,
                           pieceTraits, events, targets, unlocks, achievements
  components/, screens/    React presentation only (board SVG, HUD, sticks, talismans,
                           side panel, score juice, shop, events, title, compendium, debug)
  hooks/useGameStore.ts    wires the reducer to React, persistence and toasts
  i18n/ko.ts               centralized Korean UI strings
```

React components never implement rules: they render engine state and dispatch actions. All rules
(scoring, Yut probabilities, routing, capture, stacking, talisman resolution) live in `src/game`.

### Hooks
`onBoardStart → beforeThrow → onThrow → onResult → beforeMove → onMoveStep → afterMove → onStack →
onCapture → onThreatEnd → onGoalDecision → beforeScore (5 phases) → onGoal → afterScore → onBoardEnd`,
plus `onCaptured` (a goblin catches you) and passive `queryShopPrice / queryGoblinDistance / queryLapTable`.
Within a hook, talismans resolve strictly left → right by slot (never by object key order), so
order matters: e.g. 티끌 모아 태산 (+N) before 한 걸음 천리 (×1.5) yields more cargo than the reverse.

## 새 부적 추가하기 (Adding a talisman)

1. Pick (or add) an effect kind. Existing kinds are in `src/game/effects/effectRegistry.ts`
   (e.g. `addMomentumOnResult`, `stepCargoMultiplier`, `multiplyCaptureCargo`, `modifyStackMultiplier`,
   `modifyLapTable`, `grantExtraThrow`, `rewindTurn`…). A new kind is one entry: a name in `EffectKind`
   (`effectTypes.ts`) and a handler object with one function per hook it uses.
2. Append a definition to `TALISMANS` in `src/data/talismans.ts`:

   ```ts
   {
     id: 'sotdukkeong',
     name: '솥뚜껑',
     glyph: '鼎',
     rarity: 'uncommon',
     price: 6,
     tags: ['stack', 'cargo'],
     trigger: '칸을 밟을 때',
     condition: '말이 3개 이상 업힌 무리',
     effect: '밟은 칸 화물 ×1.5',
     effects: [{ hook: 'onMoveStep', kind: 'stepCargoMultiplier', params: { factor: 1.5 } }],
     pool: 'shop',
   }
   ```

   Score-time effects use `hook: 'beforeScore'` with a `phase` (`addCargo`, `addMomentum`,
   `cargoMult`, `stackLapMult`, `finalMult`). Growing talismans use the instance `counter`/`charges`
   and can expose `stateText` for the tooltip. Cursed talismans use `rarity: 'cursed'`,
   `pool: 'market'` and must set `downside`.
3. Run `npm test` — `talismans.test.ts` checks that every effect entry points at a registered handler
   for its hook and that cursed items show their downside, and `content.test.ts` requires a scenario
   proving that every talisman changes an observable value. Add a scenario for the new talisman there.

---

## Design decisions & tuning notes

- **Base throws are 15 / 12 / 9** (the brief suggested 10 / 8 / 6). One lap of the standard board is
  11–20 steps (~2.5 steps per base throw), so with 8 throws “One More Lap” was almost never reachable.
  The 1.25 : 1 : 0.75 ratio is preserved; edit `WAGERS` in `config.ts` to change it.
- **Targets** were recalibrated with the simulation bot: the brief's own formula makes a single plain
  lap worth ~1,000+, so its 80 / 120 / 160 opening targets would be cleared by any cash-out. The brief's
  table is kept as `BRIEF_TARGETS` in `src/data/targets.ts` next to the live table.
- **Goblins move backwards** along the graph (도깨비는 거꾸로 걷는다) and act once per player turn
  (after the base throw and all its extra throws are used). Intents can “aim” at an exposed group
  (chance grows with the yard: 15–30% in yard 1 up to 60%), but the landing node is always public;
  respawned/new goblins rest for one goblin phase so nothing unseen can capture you.
- **Boss tiers**: yards 1–2 draw only gentle bosses (외눈, 엿장수, 길막이), yards 3–5 add 거꾸로 /
  외톨이 / 붉은 탈, and the harsh 욕심 도깨비 tax appears from yard 6.
- **Pieces at home are safe.** Cashed-out pieces stay finished for the board; if every piece has
  cashed out below the target the board is lost (the goal modal warns about this).
- **Overkill bonus**: +1 coin each time a board's score doubles its target (max +3), so greed pays even
  when the board would already be cleared.
- **Stacks keep the larger lap count**, the mover's route and the union of visited nodes.

Remaining work is mostly balance and content: late-yard targets and talisman numbers were tuned with a
simple bot and deserve human playtesting; more events/bosses can be added purely as data + effect kinds.
