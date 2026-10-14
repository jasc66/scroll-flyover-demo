#!/usr/bin/env node
/**
 * capture.mjs
 * -----------------------------------------------------------------------
 * Turns one example's flight into a video, frame by frame, with the engine's
 * renderAt() (scroll-flyover 1.8.0+): no screen recording, no dropped frames, and
 * the same file on every run for the same arguments on the same machine.
 *
 *   npm run capture -- blog-tecno
 *   npm run capture -- blog-tecno --seconds 20 --fps 60 --size 1080x1920 --out tech.mp4
 *
 * Options:
 *   --seconds N     length of the video (default 16)
 *   --fps N         frames per second (default 30)
 *   --size WxH      viewport, in CSS pixels at a 1x pixel ratio (default 1920x1080).
 *                   Under 768px wide the engine switches to its 'light' tier, which
 *                   has no depth of field.
 *   --out FILE      output .mp4 (default captures/<example>.mp4)
 *   --frames DIR    write numbered PNGs to DIR instead of encoding a video
 *   --swiftshader   render on the CPU (what CI uses) instead of the GPU
 *
 * The example must expose its handle as `window.__flyover`. Encoding needs ffmpeg:
 * set FFMPEG=/path/to/ffmpeg, or have `ffmpeg` on PATH. Without it the frames are
 * written as PNGs and the ffmpeg command that would encode them is printed.
 *
 * What the video shows is the WebGL canvas only: the engine's copy panels, rail and
 * any page banner are DOM, and renderAt() draws the 3D frame, not the page.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));

function parseArgs(argv) {
  const opts = { seconds: 16, fps: 30, width: 1920, height: 1080, out: null, frames: null, swiftshader: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--seconds') opts.seconds = Number(next());
    else if (a === '--fps') opts.fps = Number(next());
    else if (a === '--size') {
      const m = /^(\d+)x(\d+)$/.exec(next());
      if (!m) throw new Error('--size takes WIDTHxHEIGHT, e.g. 1920x1080');
      opts.width = Number(m[1]);
      opts.height = Number(m[2]);
    } else if (a === '--out') opts.out = next();
    else if (a === '--frames') opts.frames = next();
    else if (a === '--swiftshader') opts.swiftshader = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else rest.push(a);
  }
  if (rest.length !== 1) throw new Error('usage: capture.mjs <example> [options] — see the header of scripts/capture.mjs');
  if (!(opts.seconds > 0) || !(opts.fps > 0) || !Number.isInteger(opts.fps)) {
    throw new Error('--seconds must be > 0 and --fps a positive integer');
  }
  return { example: rest[0], ...opts };
}

function findFfmpeg() {
  const candidates = [process.env.FFMPEG, 'ffmpeg'].filter(Boolean);
  for (const bin of candidates) {
    const probe = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (probe.status === 0) return bin;
  }
  return null;
}

// Headless Chromium falls back to SwiftShader (the CPU) unless told otherwise; on an
// Apple M2 that was about 0.7s a frame at 1080p. On macOS, ANGLE has to be pointed at
// Metal explicitly to get the GPU.
function browserArgs(swiftshader) {
  if (swiftshader) return ['--enable-unsafe-swiftshader', '--use-gl=swiftshader'];
  const args = ['--ignore-gpu-blocklist', '--enable-gpu'];
  if (process.platform === 'darwin') args.push('--use-angle=metal');
  return args;
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(url).then(() => resolve()).catch(() => {
        if (Date.now() - start > timeoutMs) reject(new Error(`server never came up at ${url}`));
        else setTimeout(poll, 300);
      });
    })();
  });
}

// libx264 with yuv420p wants even dimensions; pad by one pixel rather than fail.
const encodeArgs = (fps, out) => [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  out,
];

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const exampleDir = path.join(root, 'examples', opts.example);
  await access(path.join(exampleDir, 'index.html')).catch(() => {
    throw new Error(`no examples/${opts.example}/index.html`);
  });

  const ffmpeg = opts.frames ? null : findFfmpeg();
  const framesDir = opts.frames ?? (ffmpeg ? null : path.join(root, 'captures', `${opts.example}-frames`));
  const out = opts.out ?? path.join(root, 'captures', `${opts.example}.mp4`);
  if (framesDir) await mkdir(framesDir, { recursive: true });
  else await mkdir(path.dirname(path.resolve(out)), { recursive: true });

  const port = 8000 + Math.floor(Math.random() * 1000);
  const server = spawn(process.execPath, [path.join(root, 'scripts', 'serve.mjs'), String(port)], { stdio: 'ignore' });
  const browser = await chromium.launch({ args: browserArgs(opts.swiftshader) });

  let encoder = null;
  try {
    const base = `http://localhost:${port}`;
    await waitForServer(base);
    const page = await browser.newPage({ viewport: { width: opts.width, height: opts.height }, deviceScaleFactor: 1 });
    await page.goto(`${base}/examples/${opts.example}/index.html`);
    await page.waitForFunction(() => window.__flyover && document.querySelector('canvas'), null, { timeout: 30000 })
      .catch(() => {
        throw new Error('the page never exposed window.__flyover with a canvas (no WebGL, or the example does not expose its handle)');
      });

    const renderer = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2');
      const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return gl ? gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'unknown';
    });
    console.log(`  renderer: ${renderer}`);

    if (ffmpeg) {
      encoder = spawn(ffmpeg, encodeArgs(opts.fps, out), { stdio: ['pipe', 'inherit', 'inherit'] });
      encoder.done = new Promise((resolve, reject) => {
        encoder.on('error', reject);
        encoder.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`))));
      });
    }

    const total = Math.round(opts.seconds * opts.fps);
    const started = Date.now();
    for (let i = 0; i < total; i++) {
      // Draw and read back in the same task: the renderer does not keep its drawing
      // buffer, so after the browser composites, the canvas reads back blank.
      const dataUrl = await page.evaluate(([p, t]) => {
        if (!window.__flyover.renderAt(p, { time: t })) return null;
        return document.querySelector('canvas').toDataURL('image/png');
      }, [total === 1 ? 0 : i / (total - 1), i / opts.fps]);
      if (!dataUrl) throw new Error(`renderAt() drew nothing at frame ${i} (lost WebGL context?)`);
      const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

      if (encoder) {
        if (!encoder.stdin.write(png)) await new Promise((r) => encoder.stdin.once('drain', r));
      } else {
        await writeFile(path.join(framesDir, `frame-${String(i).padStart(5, '0')}.png`), png);
      }
      if (i % opts.fps === 0 || i === total - 1) {
        process.stdout.write(`\r  frame ${i + 1}/${total}  (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      }
    }
    process.stdout.write('\n');
    await page.evaluate(() => window.__flyover.resume());

    if (encoder) {
      encoder.stdin.end();
      await encoder.done;
      console.log(`Wrote ${path.resolve(out)} (${total} frames, ${opts.width}x${opts.height}, ${opts.fps}fps).`);
    } else {
      const rel = path.relative(process.cwd(), framesDir);
      console.log(`Wrote ${total} PNG frames to ${rel}/.`);
      if (!opts.frames) {
        console.log('No ffmpeg found (set FFMPEG or put ffmpeg on PATH). To encode them:');
      } else {
        console.log('To encode them:');
      }
      console.log(`  ffmpeg -framerate ${opts.fps} -i ${rel}/frame-%05d.png -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -c:v libx264 -crf 18 -pix_fmt yuv420p ${opts.example}.mp4`);
    }
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error(`capture: ${err.message}`);
  process.exit(1);
});
