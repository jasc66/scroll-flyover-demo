# scroll-flyover-demo

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

## Run locally

Any static file server works, e.g.:

```bash
npx serve .
```

Then open `http://localhost:3000/`.

## Source

The skill, engine source, and full documentation (camera archetypes, scene recipes,
accessibility QA, production lessons) live in the main repo:
[github.com/jasc66/scroll-flyover](https://github.com/jasc66/scroll-flyover).
