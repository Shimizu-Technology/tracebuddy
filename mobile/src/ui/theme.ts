const ink = '#172033'
const coral = '#FF7A5C'
const fontWeight = { display: '800', title: '700', body: '600' } as const
const fontFamily = {
  [fontWeight.display]: 'Nunito_800ExtraBold',
  [fontWeight.title]: 'Nunito_700Bold',
  [fontWeight.body]: 'Nunito_600SemiBold',
} as const

export const theme = {
  colors: {
    ink,
    background: '#FFFDF8',
    surface: '#FFFFFF',
    coral,
    muted: '#5B6475',
    hairline: '#ECE7DC',
  },
  pastels: {
    peach: '#FFE3D6',
    sky: '#DFF0FF',
    lilac: '#F3E5FF',
    butter: '#FFF2C2',
    mint: '#DDF5E6',
    rose: '#FFE0EC',
  },
  type: {
    display: { fontSize: 34, fontWeight: fontWeight.display, ramp: 'largeTitle' },
    title: { fontSize: 28, fontWeight: fontWeight.title, ramp: 'title1' },
    heading: { fontSize: 22, fontWeight: fontWeight.title, ramp: 'title2' },
    body: { fontSize: 17, fontWeight: fontWeight.body, ramp: 'body' },
    label: { fontSize: 15, fontWeight: fontWeight.body, ramp: 'subheadline' },
    small: { fontSize: 13, fontWeight: fontWeight.body, ramp: 'footnote' },
  },
  fontFamily,
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { tile: 24, sheet: 28, full: 999 },
  floatingShadow: {
    shadowColor: ink,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    shadowOpacity: 0.08,
  },
  target: { child: 64, adult: 48, minimum: 44 },
  icon: { size: 24, weight: 'bold' },
  motion: {
    spring: { damping: 18, stiffness: 180 },
    press: { scale: 0.96, duration: 140 },
  },
  opacity: { disabled: 0.55 },
  sheet: { smallDetent: 0.32, drawDetent: 0.39, tabletClearance: 0.075 },
  layout: {
    stackedHeaderFontScale: 2,
    threeColumns: 690,
    fourColumns: 1050,
    wordmarkMinWidth: 110,
    homeTitleWidth: 282,
    favoriteTileWidth: 136,
    recentThumbnail: 84,
    picturePreviewMax: 248,
    keepsakePreviewMax: 296,
    emptyGalleryMinHeight: 320,
  },
  border: { emphasis: 2 },
  crayon: {
    colors: [
      { name: 'Ink', value: '#18243A' }, { name: 'Red', value: '#D53540' },
      { name: 'Coral', value: coral }, { name: 'Orange', value: '#F19B23' },
      { name: 'Yellow', value: '#F6CC38' }, { name: 'Light green', value: '#67BD64' },
      { name: 'Green', value: '#23854F' }, { name: 'Sky blue', value: '#319CF2' },
      { name: 'Blue', value: '#2959C4' }, { name: 'Purple', value: '#854DC4' },
      { name: 'Pink', value: '#ED78A2' }, { name: 'Brown', value: '#926044' },
    ],
    capWidth: 27,
    bodyWidth: 58,
    bodyHeight: 34,
    shading: '#17203333',
    sizeDots: [8, 14, 20],
  },
  sample: { tileWidth: 136, artSize: 56, ruleWidth: 1, maxContentWidth: 640 },
} as const

export type TextVariant = keyof typeof theme.type
export type Pastel = keyof typeof theme.pastels
