#!/usr/bin/env node
/**
 * qa-render-at.mjs
 * -----------------------------------------------------------------------
 * The reload-reproducibility check (SKILL.md Step 8) for an example whose scenes
 * animate at rest. references/qa-reproducibility.mjs waits for the screen to stop
 * changing, which an animated scene never does; this asks the engine for fixed frames
 * instead, with renderAt(progress, { time }), and requires them to be byte-identical
 * across reloads. Same failure it exists to catch — a world that is built differently
 * on each load (Math.random, Date.now, frame-count state) — at several points of the
 * flight and with animation time in play, not only at the top of the page.
 *
 * Needs the example to expose its handle as `window.__flyover`.
 *
 * Usage: node scripts/qa-render-at.mjs <url> [--reloads N]
 * Exit code 0 = pass, 1 = fail.
 */
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url || url.startsWith('--')) {
  console.error('Usage: node qa-render-at.mjs <url> [--reloads N]');
  process.exit(1);
}
const i = process.argv.indexOf('--reloads');
const reloads = i !== -1 ? parseInt(process.argv[i + 1], 10) : 3;

// Points through the flight, each with an animation time, so a tick() that depends on
// how many frames ran before (an accumulator) shows up as a difference.
const POINTS = [[0, 0], [0.3, 1.5], [0.6, 4], [1, 9.25]];

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function capture() {
  await page.waitForFunction(() => window.__flyover && document.querySelector('canvas'), null, { timeout: 60000 });
  // Read back in the same task that drew: the renderer does not keep its buffer.
  return page.evaluate((points) => points.map(([p, time]) => {
    if (!window.__flyover.renderAt(p, { time })) return null;
    return document.querySelector('canvas').toDataURL('image/png');
  }), POINTS);
}

let fail = false;
try {
  // Warm-up: cold load fetches the CDN modules and compiles shaders. Discarded.
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  if (!(await page.evaluate(() => typeof window.__flyover?.renderAt === 'function'))) {
    console.error('FAIL: the page does not expose window.__flyover, so there is nothing to ask for a frame.');
    process.exit(1);
  }
  await capture();

  const runs = [];
  for (let r = 0; r < reloads; r++) {
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
    const frames = await capture();
    if (frames.some((f) => f === null)) {
      console.error(`FAIL: reload ${r + 1} — renderAt() drew nothing (no WebGL2, or the static fallback).`);
      fail = true;
      break;
    }
    runs.push(frames.map((f) => createHash('sha256').update(f).digest('hex')));
  }

  if (!fail) {
    POINTS.forEach(([p, time], k) => {
      const distinct = new Set(runs.map((run) => run[k]));
      if (distinct.size !== 1) {
        console.error(`FAIL: renderAt(${p}, { time: ${time} }) differs across ${reloads} reloads.`);
        fail = true;
      }
    });
    const perRun = new Set(runs[0]);
    if (perRun.size < POINTS.length) {
      console.error('FAIL: different points of the flight produced the same frame — renderAt() is not moving the camera.');
      fail = true;
    }
  }
  if (errors.length) {
    console.error(`FAIL: page errors: ${errors.join(' | ')}`);
    fail = true;
  }
} finally {
  await browser.close();
}

if (fail) process.exit(1);
console.log(`PASS: ${POINTS.length} renderAt() frames byte-identical across ${reloads} reloads, real WebGL2 scene confirmed.`);
