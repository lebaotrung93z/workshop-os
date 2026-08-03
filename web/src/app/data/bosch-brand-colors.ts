/**
 * Official Bosch brand colors (sRGB 2022).
 *
 * Guidelines:
 * - Bosch Red 50 is reserved for the logotype — not for UI accents.
 * - Accent colors must be used individually (no gradients between accent hues).
 * - Lighter/darker shades may only be combined with their main accent color.
 * - Yellow is for warnings only; red gradations for error messages only.
 */

export const boschBaseColors = {
  white: '#ffffff',
  black: '#000000'
} as const;

export const boschGray = {
  95: '#eff1f2',
  90: '#e0e2e5',
  85: '#d0d4d8',
  80: '#c1c7cc',
  75: '#b2b9c0',
  70: '#a4abb3',
  65: '#979ea4',
  60: '#8a9097',
  55: '#7d8389',
  50: '#71767c',
  45: '#656a6f',
  40: '#595e62',
  35: '#4e5256',
  30: '#43464a',
  25: '#383b3e',
  20: '#2e3033',
  15: '#232628',
  10: '#1a1c1d',
  5: '#101112'
} as const;

/** Logotype only — not for additional accent use. */
export const boschBrandRed = {
  95: '#ffecec',
  90: '#ffd9d9',
  85: '#ffc6c6',
  80: '#ffb2b2',
  75: '#ff9d9d',
  70: '#ff8787',
  65: '#ff6e6f',
  60: '#ff5152',
  55: '#ff2124',
  50: '#ed0007',
  45: '#d50005',
  40: '#be0004',
  35: '#a80003',
  30: '#920002',
  25: '#7d0002',
  20: '#680001',
  15: '#540001',
  10: '#410000',
  5: '#2d0000'
} as const;

export const boschPurple = {
  95: '#f7eef6',
  90: '#f0dcee',
  85: '#ebcae8',
  80: '#e8b6e3',
  75: '#e5a2df',
  70: '#e48cdd',
  65: '#e472db',
  60: '#e552da',
  55: '#d543cb',
  50: '#c535bc',
  45: '#b12ea9',
  40: '#9e2896',
  35: '#8b2284',
  30: '#791d73',
  25: '#671761',
  20: '#551151',
  15: '#440c41',
  10: '#340731',
  5: '#230421'
} as const;

export const boschBlue = {
  95: '#e8f1ff',
  90: '#d1e4ff',
  85: '#b8d6ff',
  80: '#9dc9ff',
  75: '#7ebdff',
  70: '#56b0ff',
  65: '#00a4fd',
  60: '#0096e8',
  55: '#0088d4',
  50: '#007bc0',
  45: '#006ead',
  40: '#00629a',
  35: '#005587',
  30: '#004975',
  25: '#003e64',
  20: '#003253',
  15: '#002742',
  10: '#001d33',
  5: '#001222'
} as const;

export const boschTurquoise = {
  95: '#def5f3',
  90: '#b6ede8',
  85: '#a1dfdb',
  80: '#8dd2cd',
  75: '#79c5c0',
  70: '#66b8b2',
  65: '#54aba5',
  60: '#419e98',
  55: '#2e908b',
  50: '#18837e',
  45: '#147671',
  40: '#116864',
  35: '#0e5b57',
  30: '#0a4f4b',
  25: '#07423f',
  20: '#053634',
  15: '#032b28',
  10: '#02201e',
  5: '#011413'
} as const;

export const boschGreen = {
  95: '#e2f5e7',
  90: '#b8efc9',
  85: '#9be4b3',
  80: '#86d7a2',
  75: '#72ca92',
  70: '#5ebd82',
  65: '#4ab073',
  60: '#37a264',
  55: '#219557',
  50: '#00884a',
  45: '#007a42',
  40: '#006c3a',
  35: '#005f32',
  30: '#00512a',
  25: '#004523',
  20: '#00381b',
  15: '#002c14',
  10: '#00210e',
  5: '#001507'
} as const;

export const boschYellow = {
  95: '#ffefd1',
  90: '#ffdf95',
  85: '#ffcf00',
  80: '#eec100',
  75: '#deb300',
  70: '#cda600',
  65: '#bd9900',
  60: '#ad8c00',
  55: '#9e7f00',
  50: '#8f7300',
  45: '#806700',
  40: '#725b00',
  35: '#644f00',
  30: '#564400',
  25: '#493900',
  20: '#3c2e00',
  15: '#2f2400',
  10: '#231a00',
  5: '#171000'
} as const;

/** Supergraphic accent colors (main shades at 50 / 40). */
export const boschAccent = {
  purple40: boschPurple[40],
  purple50: boschPurple[50],
  blue50: boschBlue[50],
  turquoise50: boschTurquoise[50],
  green50: boschGreen[50]
} as const;

/** Functional colors — warnings, errors, positive feedback. */
export const boschWarning = {
  yellow85: boschYellow[85],
  green50: boschGreen[50],
  red50: boschBrandRed[50],
  blue50: boschBlue[50]
} as const;

/** Semantic tokens for the dark dashboard UI. */
export const boschBrandColors = {
  white: boschBaseColors.white,
  black: boschBaseColors.black,
  logoRed: boschBrandRed[50],

  gray95: boschGray[95],
  gray90: boschGray[90],
  gray85: boschGray[85],
  gray80: boschGray[80],
  gray75: boschGray[75],
  gray70: boschGray[70],
  gray65: boschGray[65],
  gray60: boschGray[60],
  gray55: boschGray[55],
  gray50: boschGray[50],
  gray45: boschGray[45],
  gray40: boschGray[40],
  gray35: boschGray[35],
  gray30: boschGray[30],
  gray25: boschGray[25],
  gray20: boschGray[20],
  gray15: boschGray[15],
  gray10: boschGray[10],
  gray5: boschGray[5],

  accentYellow85: boschYellow[85],
  accentYellow90: boschYellow[90],
  accentYellow70: boschYellow[70],
  accentPurple: boschAccent.purple40,
  accentBlue: boschAccent.blue50,
  accentTurquoise: boschAccent.turquoise50,
  accentGreen: boschGreen[60],

  surface: boschGray[10],
  surfaceElevated: boschGray[15],
  border: boschGray[25],
  textPrimary: boschGray[95],
  textMuted: boschGray[65],
  grayMuted: boschGray[65],

  mapLand: boschGray[60],
  mapOcean: boschGray[10],

  /** Revenue tiers — accent palette for data visualization. */
  performanceHigh: boschGreen[60],
  performanceMedium: boschYellow[85],
  performanceLow: boschBrandRed[60],

  link: boschYellow[85],
  revenue: boschAccent.turquoise50
} as const;
