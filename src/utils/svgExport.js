/**
 * Render an inline <svg> (with data-width / data-height) to a 2x PNG blob.
 * @param {SVGSVGElement} svg
 * @param {string} background CSS colour painted behind the drawing
 */
export async function svgToPng(svg, background, scale = 2, watermark = null) {
  const w = Number(svg.dataset.width);
  const h = Number(svg.dataset.height);
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', background);
  clone.insertBefore(bg, clone.firstChild);
  // Optional "Made with TripSplit" mark in the bottom-right corner.
  if (watermark?.text) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', String(w - 10));
    t.setAttribute('y', String(h - 10));
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('font-size', String(watermark.size ?? 11));
    t.setAttribute('font-weight', '600');
    t.setAttribute('font-family', "'Inter Variable', Inter, ui-sans-serif, system-ui, sans-serif");
    t.setAttribute('fill', watermark.color ?? '#71717a');
    t.textContent = watermark.text;
    clone.appendChild(t);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
