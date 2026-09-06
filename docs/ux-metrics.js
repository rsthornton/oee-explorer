// Pasted into the browser console, or evaluated by scripts/ux/check.mjs.
// Returns the numbers the visualization-overhaul epic (#1) asks every
// child issue to report.
(() => {
  const canvases = [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    let dark = -1;
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      dark = 0;
      for (let i = 0; i < d.length; i += 16) if (d[i] < 120 && d[i + 3] > 0) dark++;
    } catch (e) {}
    return {
      name: c.className || c.parentElement?.className || 'canvas',
      cssWidth: Math.round(r.width),
      cssHeight: Math.round(r.height),
      top: Math.round(r.top),
      darkSamples: dark,
    };
  });
  const net = canvases.find((c) => c.name.includes('network'));
  return {
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    networkTop: net ? net.top : null,
    networkVisiblePx: net ? Math.max(0, Math.min(net.cssHeight, innerHeight - net.top)) : 0,
    canvases,
  };
})()
