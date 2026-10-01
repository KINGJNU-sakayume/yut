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
  [400, 700, 1000],
  [2000, 2800, 3800],
  [5000, 7000, 9500],
  [12500, 17500, 24000],
  [26000, 36000, 50000],
  [55000, 80000, 110000],
  [120000, 170000, 230000],
  [260000, 360000, 500000],
]
