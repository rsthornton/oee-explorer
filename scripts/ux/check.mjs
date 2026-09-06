// Headless checkpoint for the visualization-overhaul epic (#1).
// Usage: node scripts/ux/check.mjs <label>
// Builds nothing; expects dist/ to exist. Serves it with vite preview, then
// records screenshots and docs/ux-metrics.js numbers at two viewports, walks
// the Guide's first path, measures fps at Deep Chaos, and checks that every
// canvas repaints after a resize. Output: docs/ux-checkpoints/<label>/.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const label = process.argv[2] || 'run';
const port = Number(process.env.UX_PORT || 4381);
const url = `http://localhost:${port}/`;
const out = join('docs', 'ux-checkpoints', label);
mkdirSync(out, { recursive: true });
const metricsSrc = readFileSync('docs/ux-metrics.js', 'utf8');

const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const stop = () => { try { preview.kill(); } catch {} };
process.on('exit', stop);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40; i++) {
  try { const r = await fetch(url); if (r.ok) break; } catch {}
  await wait(250);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { label, viewports: {}, firstPath: {}, fps: null, resizeRepaint: null, experiments: null };

async function fresh(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load' });
  await wait(1500);
  return { ctx, page };
}

for (const [w, h] of [[1440, 900], [1440, 720], [390, 844]]) {
  const key = `${w}x${h}`;
  const { ctx, page } = await fresh(w, h);
  await page.screenshot({ path: join(out, `fresh-${key}.png`) });
  result.viewports[key] = await page.evaluate(metricsSrc);
  await ctx.close();
}

{
  const { ctx, page } = await fresh(1440, 900);
  for (const name of ['Tiny World', 'Deep Freeze', 'Edge of Chaos', 'The Switcher']) {
    const chip = page.getByRole('button', { name, exact: true });
    const found = (await chip.count()) > 0;
    if (found) { await chip.first().click(); await wait(2500); }
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: join(out, `path-${slug}.png`) });
    result.firstPath[name] = { found, metrics: found ? await page.evaluate(metricsSrc) : null };
  }
  const chaos = page.getByRole('button', { name: 'Deep Chaos', exact: true });
  if ((await chaos.count()) > 0) {
    await chaos.first().click();
    await wait(1000);
    result.fps = await page.evaluate(() => new Promise((resolve) => {
      const frames = [];
      let last = performance.now();
      const tick = (t) => { frames.push(t - last); last = t; if (t - t0 < 10000) requestAnimationFrame(tick); else done(); };
      const t0 = performance.now();
      const done = () => { const s = frames.slice(1).sort((a, b) => a - b); const med = s[Math.floor(s.length / 2)] || 0; resolve({ medianFps: med ? Math.round(1000 / med) : 0, frames: frames.length }); };
      requestAnimationFrame(tick);
    }));
  }
  const before = await page.evaluate(metricsSrc);
  await page.setViewportSize({ width: 1000, height: 800 });
  await wait(800);
  const after = await page.evaluate(metricsSrc);
  await page.screenshot({ path: join(out, 'after-resize-1000x800.png') });
  result.resizeRepaint = {
    before: before.canvases.map((c) => [c.name, c.darkSamples]),
    after: after.canvases.map((c) => [c.name, c.darkSamples]),
    allPainted: before.canvases.every((c, i) => c.darkSamples <= 0 || (after.canvases[i] && after.canvases[i].darkSamples > 0)),
  };
  await ctx.close();
}

{
  const { ctx, page } = await fresh(1440, 900);
  const tab = page.getByRole('button', { name: 'Experiments', exact: true });
  if ((await tab.count()) > 0) {
    await tab.first().click();
    await wait(2000);
    await page.screenshot({ path: join(out, 'experiments-on-open.png') });
    const m = await page.evaluate(metricsSrc);
    result.experiments = { canvases: m.canvases.map((c) => [c.name, c.darkSamples]), chartPainted: m.canvases.some((c) => c.darkSamples > 0) };
  }
  await ctx.close();
}

await browser.close();
stop();
writeFileSync(join(out, 'metrics.json'), JSON.stringify(result, null, 2));
const v = result.viewports;
console.log(JSON.stringify({
  label,
  networkVisiblePx_1440x900: v['1440x900']?.networkVisiblePx,
  networkTop_1440x900: v['1440x900']?.networkTop,
  networkVisiblePx_1440x720: v['1440x720']?.networkVisiblePx,
  overflow_390x844: v['390x844']?.horizontalOverflow,
  networkVisiblePx_390x844: v['390x844']?.networkVisiblePx,
  medianFpsDeepChaos: result.fps?.medianFps,
  resizeAllPainted: result.resizeRepaint?.allPainted,
  experimentsChartPainted: result.experiments?.chartPainted,
}, null, 2));
process.exit(0);
