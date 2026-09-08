# scroll-flyover-demo

[![QA](https://github.com/jasc66/scroll-flyover-demo/actions/workflows/qa.yml/badge.svg)](https://github.com/jasc66/scroll-flyover-demo/actions/workflows/qa.yml)

Live demo gallery for [scroll-flyover](https://github.com/jasc66/scroll-flyover), a Claude
Code skill that builds scroll-scrubbed 3D worlds with live Three.js/WebGL — no AI image or
video generation, zero per-build cost, fully procedural geometry.

Four builds, four camera archetypes, one shared engine (`references/scrub-engine.js`):

| Demo | Domain | Camera | Shape language |
|---|---|---|---|
| [Alta Finca](examples/nature-coffee-farm/) | Coffee farm | Island hop / swoop | Low-poly |
| [Marco Estudio](examples/architecture-studio/) | Architecture studio | Corridor / glide | Geometric |
| [Nexo Ops](examples/saas-nexo-ops/) | SaaS product | Vertical descent / glide | Geometric |
| [Ala Sneaker](examples/product-ala-sneaker/) | Product showcase | Orbit / swoop | Toy |

Each `index.html` is self-contained (Three.js loaded from a CDN import map) and imports the
shared engine and scene-building recipes via relative paths — open any of them directly, no
build step.

## Engine source

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

## QA

`npm run qa` starts a local server and, for each example, checks reload-reproducibility
(SKILL.md Step 8, automated) and real rendered WCAG color-contrast (screenshots the scene
with overlay text hidden vs. visible and measures actual contrast — robust to the
canvas/overlay layering that makes DOM-based checkers like axe-core unreliable here).
Requires `npx playwright install chromium` first. Runs in CI on every push/PR.

## Source

The skill, full documentation (camera archetypes, scene recipes, accessibility QA,
production lessons), and npm package all live in the main repo:
[github.com/jasc66/scroll-flyover](https://github.com/jasc66/scroll-flyover).
