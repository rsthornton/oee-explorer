// Checks the Landscape tab and the Research tab's connections in a real browser.
// Usage: npm run build && node scripts/ux/connections.mjs
//   1. every "Show this" lands on its tab, at its seed (and K), panel in view;
//   2. every "Where this shows up" chip opens Research at an entry that exists;
//   3. no console errors, no horizontal overflow at phone width;
//   4. every reference URL answers (reported, not failed: some publishers refuse bots).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';

const port = Number(process.env.UX_PORT || 4383);
const url = `http://localhost:${port}/`;
const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => { try { preview.kill(); } catch {} });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 40; i++) { try { if ((await fetch(url)).ok) break; } catch {} await wait(250); }

let pass = 0, fail = 0;
const check = (ok, msg) => { ok ? pass++ : fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const [w, h, label] of [[1440, 900, 'desktop'], [390, 844, 'phone']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.location().url)) errors.push(m.text()); });
  await page.goto(url);
  const tab = (name) => page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: true });

  await tab('Landscape').click();
  await wait(800);
  check((await page.locator('.landscape-readout').count()) === 2, `${label}: Landscape shows two panels`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: Landscape has no horizontal overflow`);

  // "Where this shows up" chips → Guide entries
  const chipIds = await page.locator('[data-connection]').evaluateAll((els) => els.map((e) => e.dataset.connection));
  for (const id of chipIds) {
    await tab('Landscape').click();
    await wait(200);
    await page.locator(`[data-connection="${id}"]`).click();
    await wait(300);
    const inView = await page.evaluate((id) => {
      const el = document.getElementById(`conn-${id}`);
      if (!el) return 'missing';
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > 0 ? 'in view' : 'off screen';
    }, id);
    check(inView === 'in view', `${label}: chip "${id}" opens its Research entry (${inView})`);
  }

  // Research → Show this
  await tab('Research').click();
  await wait(300);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: Research has no horizontal overflow`);
  const targets = await page.locator('[data-show]').evaluateAll((els) => els.map((e) => e.dataset.show));
  check(targets.length > 0, `${label}: Research lists ${targets.length} Show this links`);
  for (let i = 0; i < targets.length; i++) {
    await tab('Research').click();
    await wait(200);
    const t = JSON.parse(targets[i]);
    await page.locator('[data-show]').nth(i).click();
    await wait(1400);
    const active = (await page.locator('.tab-active').innerText()).trim().toLowerCase();
    const want = t.tab === 'instrument' ? 'simulate' : t.tab; // the Instrument view's tab reads Simulate
    check(active === want, `${label}: Show this #${i + 1} lands on ${want} (got ${active})`);
    if (t.tab === 'landscape') {
      const idx = t.panel === 'basin' ? 0 : 1;
      const text = await page.locator('.landscape-readout').nth(idx).innerText();
      check(text.includes(`seed ${t.seed}`), `${label}: #${i + 1} ${t.panel} panel at seed ${t.seed}`);
      if (t.k !== undefined) {
        const kv = await page.locator('.landscape-slider input').nth(1).inputValue();
        check(Number(kv) === t.k, `${label}: #${i + 1} damage map at K = ${t.k} (got ${kv})`);
      }
      const vis = await page.locator('.landscape-panel').nth(idx).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
      check(vis, `${label}: #${i + 1} target panel is in view`);
    }
  }
  check(errors.length === 0, `${label}: no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

// reference URLs (reported only)
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Research', exact: true }).click();
  const hrefs = [...new Set(await page.locator('.connection-refs a').evaluateAll((els) => els.map((e) => e.href)))];
  for (const href of hrefs) {
    let status = 'error';
    try { status = (await fetch(href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } })).status; } catch (e) { status = e.message; }
    console.log(`ref  ${status} ${href}`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
