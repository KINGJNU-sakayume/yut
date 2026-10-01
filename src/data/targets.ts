// Board target scores. [small, big, boss] per yard. Tune freely — nothing else hardcodes them.
//
// The design brief suggested 80/120/160 … 88,000/125,000/170,000. With the brief's own
// scoring formula a single plain lap already scores ~1,000+, so the brief's table is kept
// below as a reference and the live table is calibrated by simulation (npm run sim).

export const BRIEF_TARGETS: readonly (readonly [number, number, number])[] = [
  [80, 120, 160],
  [220, 320, 430],
  [600, 850, 1150],
  [1600, 2300, 3100],
  [4300, 6200, 8400],
  [11800, 17000, 23000],
  [32000, 46000, 62000],
  [88000, 125000, 170000],
]

export const TARGETS: readonly (readonly [number, number, number])[] = [
  [500, 800, 1200],
  [1500, 2200, 3000],
  [4000, 5500, 7500],
  [10000, 14000, 19000],
  [26000, 36000, 50000],
  [70000, 100000, 140000],
  [190000, 270000, 380000],
  [520000, 740000, 1000000],
]
