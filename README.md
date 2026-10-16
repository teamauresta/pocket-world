# Pocket World

A living island diorama built with Three.js and WebGL 2: procedural terrain,
forests, wildlife, sea life, weather, and a day/night cycle.

## Run locally

Requires Node.js 22 or later.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/?proceduralModels=1` to explore using procedural
wildlife. The optional supplied-model mode requires separately acquired assets.
Their `.glb` files are deliberately excluded from this repository.

```bash
npm test
npm run build
npm run build:lab
```

Production output is written to `dist/`. The optional creature lab is available
at `/lab.html` in development. Private-asset qualification tests may skip or
require additional fixtures; see the test output and technical handoffs.

Set `POCKET_WORLD_TIGER_SOURCE` to a legitimately acquired original tiger model
only when running its optional source qualification tests.

## Project structure

| Folder | Contents |
| --- | --- |
| `src/world/` | Terrain, atmosphere, water, weather, and lighting |
| `src/veg/` | Procedural trees, plants, and vegetation materials |
| `src/fauna/`, `src/creatures/` | Wildlife geometry, animation, and behavior |
| `src/sea/` | Reef and marine life |
| `src/render/` | Render pipeline and shared shaders |
| `src/ui/`, `src/audio/` | Controls and ambient audio |
| `scripts/`, `review/` | Build tools and review harnesses |
| `docs/` | Technical notes and historical qualification limits |

## License

Original Pocket World code is licensed under the [ISC License](LICENSE).

Third-party code, textures, and other assets retain their respective licenses
and attribution requirements; the ISC license does not replace those terms.
See the notices in `licenses/` and the credits below. Supplied and derived
wildlife models are excluded from this repository and are not covered by the
project's ISC license. Their use or redistribution requires separate permission
under the applicable asset terms.

## Assets and credits

Application source and third-party assets have separate licensing requirements.
Supplied and derived wildlife models are not licensed for redistribution by the
application package license. Acquire and review asset rights independently;
see [asset license notes](docs/ASSET-LICENCE-REVIEW-20261015.md) and attribution
files under `public/owner-models/`.

- Tree branching adapted from [EZ-Tree](https://github.com/dgreenheck/ez-tree)
  by Daniel Greenheck (MIT). Leaf, grass, and dirt textures come from the same
  project; bark photographs originate from Poly Haven and TextureCan (CC0).
- Water normal map from the three.js examples (MIT).
- [three.js](https://threejs.org) (MIT).

See [SECURITY.md](SECURITY.md) for secret scanning, local review configuration,
and preview access requirements. Historical handoffs describe prior local
milestones; their example URLs and release identifiers are not live endpoints.
