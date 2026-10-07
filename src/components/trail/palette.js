// Trip Journey palette: calm paper / deep-navy themes, one accent, Inter labels.
export const ACCENT = '#D9483B';
export const SANS = "'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif";
export const GROT = "'Space Grotesk Variable', 'Space Grotesk', 'DM Sans', ui-sans-serif, system-ui, sans-serif";

/**
 * Light "paper" theme and dark "deep navy" theme.
 * @returns {{dark: boolean, paper: string, text: string, sub: string, road: string,
 *   edge: string, lane: string, disc: string, band: [string, string], tree: string, hill: string}}
 */
export function trailPalette(dark) {
  return dark
    ? {
        dark: true,
        paper: '#141A29',
        text: '#ECEAE4',
        sub: '#98A0B3',
        road: '#07090F',
        edge: '#3A4462',
        lane: '#C7CAD3',
        disc: '#E9E7E1',
        band: ['#18202F', '#141A29'],
        tree: '#2C3E45',
        hill: '#1E2A36',
      }
    : {
        dark: false,
        paper: '#F4F1EA',
        text: '#1D1D2B',
        sub: '#6E6B66',
        road: '#26262E',
        edge: '#FFFDF8',
        lane: '#F4F1EA',
        disc: '#FFFDF8',
        band: ['#EFEBE2', '#F4F1EA'],
        tree: '#A9B89C',
        hill: '#D8DDCB',
      };
}

/** Faint background tint behind a stop icon, by scene. */
export const SCENE_TINT = {
  beach: '#CDEBF7',
  city: '#FBE6B2',
  mountain: '#CFE3C9',
  food: '#F7D3C7',
  transport: '#EFE2C6',
  stay: '#F2DCC0',
  fun: '#F6D2D5',
  misc: '#E9E1CF',
};

/** Saturated twin of each SCENE_TINT, used for the stop icon ring. */
export const SCENE_RING = {
  beach: '#2E9CCB',
  city: '#D9A21B',
  mountain: '#4E9A57',
  food: '#D9603F',
  transport: '#A88442',
  stay: '#B97A3A',
  fun: '#D2566A',
  misc: '#8C7F63',
};
