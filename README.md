# scroll-flyover-demo

[![QA](https://github.com/jasc66/scroll-flyover-demo/actions/workflows/qa.yml/badge.svg)](https://github.com/jasc66/scroll-flyover-demo/actions/workflows/qa.yml)

Live demo gallery for [scroll-flyover](https://github.com/jasc66/scroll-flyover), a Claude
Code skill that builds scroll-scrubbed 3D worlds with live Three.js/WebGL — no AI image or
video generation, zero per-build cost, fully procedural geometry.

Five builds, one shared engine (`references/scrub-engine.js`): four showcases, one per
camera archetype, and the hero of a site in production:

| Demo | Domain | Camera | Shape language |
|---|---|---|---|
| [Alta Finca](examples/nature-coffee-farm/) | Coffee farm | Island hop / swoop | Low-poly |
| [Marco Estudio](examples/architecture-studio/) | Architecture studio | Corridor / glide | Geometric |
| [Nexo Ops](examples/saas-nexo-ops/) | SaaS product | Vertical descent / glide | Geometric |
| [Ala Sneaker](examples/product-ala-sneaker/) | Product showcase | Orbit / swoop | Toy |
| [TechInsight](examples/blog-tecno/) | **Real project**: tech news blog | Corridor / glide | Geometric |

TechInsight is the hero of [blog-tecno.vercel.app](https://blog-tecno.vercel.app/), a
Next.js 14 site that depends on `scroll-flyover` from npm. The example is that component as
a static page: same palette, seed, layout, copy, scenes and `--sf-*` tokens, so it shows
what a real integration needs around the engine (a loader, a brand banner that fades on
scroll, host CSS that keeps the sticky canvas working). It differs from production in three
places, each commented: depth of field is on, the forum CTA is a real `ctaHref` link rather
than a click handler matched by button text, and one scene animation is a function of time
instead of a per-frame accumulator, so `renderAt()` can reproduce it.

Each `index.html` is self-contained (Three.js loaded from a CDN import map) and imports the
shared engine and scene-building recipes via relative paths — open any of them directly, no
build step.

Every demo mounts with `effects: createEffects({ depthOfField: true })` (scroll-flyover
1.10.0+): sharp while the camera dwells at a scene, softening between scenes, focused on
the one ahead. Off automatically on the light tier (phones, coarse pointers).

## The gallery page

The root `index.html` is the landing page that links the demos — a single static file,
inline CSS, no JavaScript. Three motion gestures guide the eye:

- **Shared element** — opening a demo, its preview grows to fill the screen as the gallery
  fades out (cross-document View Transitions). Each demo carries an empty full-screen
  `.vt-arrival` layer with the matching `view-transition-name`, because the engine's canvas
  does not exist yet when the browser starts the transition. Browsers without support get a
  plain navigation.
- **Blur** — hovering or keyboard-focusing a card blurs and dims the other three, the same
  idea as the demos' depth of field. Needs `:has()`; without it nothing blurs.
- **Crossfade** — the focused card fades to a later scene of its flight (`preview-2.png` in
  each example folder). Only on interaction, never on a timer.

Under `prefers-reduced-motion` there is no page transition and no scaling, and the crossfade
is an instant swap.

## Engine source

Currently pinned: **scroll-flyover 1.10.0**.

`references/` here is **not** hand-maintained — it's copied from the published
[`scroll-flyover`](https://www.npmjs.com/package/scroll-flyover) npm package (pinned in
`package.json`) by `npm run sync` (also runs automatically as a `postinstall` step, so a
plain `npm install` keeps it current with whatever version is pinned). This is the single
source of truth for the engine; nothing here is edited directly.

To pick up an engine fix from the skill repo: bump the `scroll-flyover` version in
`package.json`, run `npm install`, then commit the refreshed `references/`. CI fails the
build if `references/` doesn't match what the pinned version produces, so a version bump
without a matching commit can't merge silently.

## Run locally

```bash
npm install
npm run serve
```

Then open `http://localhost:8080/examples/<name>/`. `npm run serve` (not `npx serve`)
matters here — a generic static server can redirect `index.html` URLs to an extensionless
path or serve `.js` as `text/plain` depending on OS MIME registry, either of which breaks
the examples' relative ES module imports.

## Video capture

`npm run capture -- <example>` turns a flight into an MP4, frame by frame, with the engine's
`renderAt(progress, { time })` (scroll-flyover 1.8.0+). No screen recording, so no dropped
frames, and the same arguments on the same machine give the same frames.

```bash
npm run capture -- blog-tecno                          # 16s, 30fps, 1920x1080 → captures/blog-tecno.mp4
npm run capture -- blog-tecno --size 1080x1920 --seconds 12 --out reel.mp4
npm run capture -- blog-tecno --frames frames/         # numbered PNGs, no encoding
```

Encoding needs ffmpeg (`brew install ffmpeg`, or point `FFMPEG` at a binary); without it the
script writes PNGs and prints the command to encode them. The video is the WebGL canvas only:
copy panels, the scene rail and page banners are DOM and are not in it.

On macOS the script asks Chromium for Metal explicitly: headless Chromium otherwise renders
WebGL on the CPU (SwiftShader), measured at about 0.7s a frame at 1080p on an Apple M2 against
about 0.08s on the GPU. `--swiftshader` forces the CPU path, which is what CI has.

An example opts in by exposing its handle as `window.__flyover`. Only `blog-tecno` does so
far.

## QA

`npm run qa` starts a local server and, for each example, checks reload-reproducibility
(SKILL.md Step 8, automated) and real rendered WCAG color-contrast (screenshots the scene
with overlay text hidden vs. visible and measures actual contrast — robust to the
canvas/overlay layering that makes DOM-based checkers like axe-core unreliable here).
Requires `npx playwright install chromium` first. Runs in CI on every push/PR.

An example whose scenes animate at rest (`userData.tick`), like `blog-tecno`, says so in an
`examples/<name>/qa.json` of `{ "animated": true }`. The reload check above waits for the
screen to stop changing, which an animated scene never does, so for these
`scripts/qa-render-at.mjs` asks the engine for four fixed frames through the flight with
`renderAt(progress, { time })` and requires them byte-identical across reloads. That also
catches an animation that accumulates per frame (`x += …` in a tick), which the still-screen
check could not. Contrast is scored under `prefers-reduced-motion`, where the engine holds
the scene still.

## Source

The skill, full documentation (camera archetypes, scene recipes, accessibility QA,
production lessons), and npm package all live in the main repo:
[github.com/jasc66/scroll-flyover](https://github.com/jasc66/scroll-flyover).
