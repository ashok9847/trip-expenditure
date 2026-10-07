// "Share as story": a 9:16 (1080x1920) PNG of the fully travelled map (R11.18).
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import groteskUrl from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
import MapScene from './MapScene.jsx';
import { SANS } from './palette.js';
import { svgToPng } from '../../utils/svgExport.js';

const SW = 1080;
const SH = 1920;
const MAP_TOP = 300;
const FOOTER_H = 110;

// Mirrors the .stk-art rules in trail.css; external CSS does not apply inside an <img>-rendered SVG.
const STICKER_CSS =
  ".stk-art [stroke-width='2.5']{stroke-width:1.7px}" +
  ".stk-art [stroke-width='2.2'],.stk-art [stroke-width='2']{stroke-width:1.5px}";

function StorySvg({ layout, trip, stops, view, pal, money, nameOf, total }) {
  const mapH = SH - MAP_TOP - FOOTER_H;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} data-width={SW} data-height={SH}>
      <defs>
        <style>{STICKER_CSS}</style>
      </defs>
      <rect width={SW} height={SH} fill={pal.paper} />
      <text x="80" y="170" fontFamily={SANS} fontSize="96" fontWeight="700" fill={pal.text}>
        {trip.name}
      </text>
      <text x="82" y="236" fontFamily={SANS} fontSize="40" fontWeight="500" fill={pal.sub}>
        {`${stops.length} ${stops.length === 1 ? 'stop' : 'stops'} · ${money(total)}`}
      </text>
      <svg x="40" y={MAP_TOP} width={SW - 80} height={mapH} viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMin meet">
        <MapScene
          layout={layout}
          trip={trip}
          stops={stops}
          view={view}
          pal={pal}
          reached={stops.length}
          landed={null}
          idp="st"
          live={false}
          showBase={false}
          reduced
          money={money}
          nameOf={nameOf}
        />
      </svg>
      <text x={SW / 2} y={SH - 50} textAnchor="middle" fontFamily={SANS} fontSize="30" fontWeight="500" fill={pal.sub}>
        Made with TripSplit
      </text>
    </svg>
  );
}

async function toDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** Base64 @font-face rules for Inter and Space Grotesk; empty string if fetching fails. */
async function fontFaceCss() {
  try {
    const [inter, grotesk] = await Promise.all([toDataUrl(interUrl), toDataUrl(groteskUrl)]);
    return (
      `@font-face{font-family:'Inter Variable';font-weight:100 900;src:url(${inter}) format('woff2')}` +
      `@font-face{font-family:'Space Grotesk Variable';font-weight:300 700;src:url(${grotesk}) format('woff2')}`
    );
  } catch {
    return ''; // fall back to system fonts
  }
}

/**
 * Render the story offscreen and return a PNG blob.
 * @param {{layout, trip, stops, view, pal, money, nameOf, total}} props
 * @returns {Promise<Blob>}
 */
export async function renderStory({ layout, trip, stops, view, pal, money, nameOf, total }) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:1080px;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(<StorySvg layout={layout} trip={trip} stops={stops} view={view} pal={pal} money={money} nameOf={nameOf} total={total} />),
    );
    const svg = host.querySelector('svg');
    // Fonts inside an <img>-rendered SVG must be embedded.
    const fonts = await fontFaceCss();
    if (fonts) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = fonts;
      svg.querySelector('defs').appendChild(style);
    }
    return await svgToPng(svg, pal.paper, 1);
  } finally {
    root.unmount();
    host.remove();
  }
}
