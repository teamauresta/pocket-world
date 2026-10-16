# Pocket World: Sky, Weather, Detail and Motion Build Guide

Oct 14, 2026 · @Studio8

## Overview

This guide adds a visible sun and moon, a real night sky, weather (cloud, rain, storms, wind) and animal reactions to Pocket World, the Three.js island diorama, and raises the detail and motion of every animal, plant and sea creature. It is written for a front-end developer comfortable with Three.js and GLSL who is new to this codebase.

Everything builds on systems that already exist. The light already follows the time of day, wind already sways the plants, and animals already run a simple state machine. The new work is mostly one shared weather state that every system reads, plus a handful of new visual pieces.

**Goals**

- The sun and moon are visible, and the scene's main light always comes from whichever one is shown.
- Night looks like night: stars, a Milky Way, the odd shooting star, moonlight on the water.
- Weather changes smoothly between Clear, Cloudy, Rain and Storm, either picked by the viewer or drifting on its own (Auto, the default).
- Wind strength is one value that plants, water, particles and sound all follow.
- Animals visibly respond to rain, lightning, wind and darkness.
- Animals move naturally: feet stay planted, bodies carry weight, turns curve, and tails and heads follow through.
- Animals, trees and sea creatures hold up in close views: readable faces, fur, sharp markings, varied layered canopies, recognisable fish.
- It stays smooth: 60 fps on a recent laptop, 30 fps on a mid-range phone, with automatic scaling in between.

**Out of scope:** changes to the island's shape. Swapping in artist-made animal models is covered as an optional final step.

## Codebase orientation

All features plug into one frame loop (`tick()` in `src/main.js`) and one set of shared shader uniforms (`U` in `src/render/shared.js`). Add a new `Weather` module next to `Atmosphere`, update it once per frame, and let every other system read from it.

| File | What it does today | What changes |
| --- | --- | --- |
| `src/main.js` | Builds the scene, runs `tick()`: advances `hour`, calls `atmo.setTime`, `life.update`, `fauna.update`, `birds.update`, `ambience.update`, then renders | Create and update `Weather`; pass it to the systems below |
| `src/render/shared.js` | Shared uniforms: `uTime`, `uSunDir`, `uSunColor`, `uSkyZenith`, `uSkyHorizon`, `uAmbient`, `uNight`, `uWind`, `uWaterAbsorb`; the `patchUnderwater` shader patch | Add `uWet`, `uRain`, `uCloud`, `uFlash`, `uWindGust`, `uMoonDir`, `uMoonPhase` |
| `src/world/atmosphere.js` | `Atmosphere`: one `DirectionalLight` used as sun by day and moon by night, a hemisphere fill, the backdrop sphere shader (with faint stars), and a `Sky` used only to bake the environment map. `sunDirection(hour)` and `setTime(hour)` | Visible sun and moon discs, moon phases, new star field, cloud dimming, lightning flash |
| `src/world/water.js` | Sea surface and glass sides in one screen-space shader: three sine waves, normal-map detail, foam, night plankton | Wave height from wind, rain ripples, moon glitter, storm foam |
| `src/world/river.js`, `mist.js` | River ribbon, waterfall curtain, spray | Faster flow and more spray in rain |
| `src/world/terrain.js` | Splatted terrain shader with `gWet` and `gRough` already computed | Global wetness from `uWet`, puddles |
| `src/veg/materials.js` | `applyWind()` injects sway into every plant shader using `uWind`, `uTime` and a built-in gust term | Scale sway by wind strength; travelling gust fronts |
| `src/fauna/animals.js`, `src/creatures/gait.js` | Land animal agents: states `walk`, `idle`, `graze`, `sit`, `lie`; deer flee tigers; poses in `pose()` | New states (shelter, startle, sleep, shake) and weather-driven choices |
| `src/fauna/birds.js` | Flocks on scripted flight paths | Land and perch during rain |
| `src/sea/life.js` | Fish schools, reef fish, sharks, manta, turtles with steering | Dive deeper in storms, turtles surface to breathe |
| `src/audio/ambience.js` | Live Web Audio: surf, wind, waterfall, birdsong, crickets | Rain, thunder, wind level from weather |
| `src/ui/hud.js`, `index.html` | Bottom dock: play/pause, time slider, viewpoints, sound | Weather and wind controls |

**Useful tools already in the repo**

- `window.__isle.capture({ name, time, sim, pos, target })` renders a still for any view and time of day. `scripts/shot.mjs` wraps it for headless screenshots.
- `scripts/interact.mjs` clicks through every control and reports console errors. Add `?lite=1` to the URL to cut instance counts so software rendering stays fast.
- `lab.html` shows creatures on their own, posed, for checking new animations.
- `govern()` in `main.js` lowers the pixel ratio when frames run slow. `quality` is `'high'` or `'low'` (phones).

## Feature 1: visible sun and moon

Draw a sun disc and a moon disc on the backdrop, and drive the scene's light from their positions, so the shadows always point away from what the viewer sees in the sky.

**Positions**

- Sun: keep `Atmosphere.sunDirection(hour)` as is. It rises back-right, peaks at 64° around 12:30, and sets front-left around 18:36.
- Moon: replace the current fake moon direction (`-d.x * 0.6, 0.75, -d.z * 0.6`) with a real arc. Use the sun formula shifted by 12.4 hours plus a phase offset, so the moon rises later each night: `moonDirection(hour, phase)` with `hourOffset = 12.4 + phase * 24.8`. Clamp its peak at 55°.
- Phase: `phase = (dayCount / 29.5) % 1`, where `dayCount` goes up by one each time `hour` wraps past 24. Start at 0.35 so the first night has a big waxing moon.

**Drawing the discs**

- Add both to the backdrop shader in `atmosphere.js` (`backFrag`). They sit at infinity and never clip the diorama.
- Sun: a disc of angular radius 0.035 rad with a soft edge, plus a halo `pow(max(dot(d, sunDir), 0), 24) * 0.6` and a wider glow `pow(..., 4) * 0.25`. Colour from the existing `sunCol` (white at noon, orange at sunset). Below the horizon it vanishes.
- Moon: angular radius 0.03 rad. Shade it as a sphere lit from the sun's side so phases come out naturally: compute the disc's local normal from the fragment's offset, then `lit = smoothstep(-0.05, 0.05, dot(n, phaseLightDir))`, where `phaseLightDir` rotates around the view axis with `phase`. Add faint maria with low-frequency noise and a pale blue glow ring.
- Fade both with the backdrop: hidden by `uCloud` (see Feature 3), sun dimmed through haze near the horizon.

**Light source**

- `setTime()` already blends sun and moon intensity across twilight and swaps the light's direction when both are faint (between −4° and −7° sun elevation). Keep that, but point the moon light at the new moon direction.
- Moon intensity scales with phase: `1.45 * moonW * (0.25 + 0.75 * illuminated)`, where `illuminated = 0.5 * (1 - cos(2π · phase))`. A new moon night is properly dark, so the fireflies and plankton carry it.
- When the moon is below the horizon at night, fall back to the hemisphere fill only, raised by 0.1, so the island never goes fully black.
- Publish `uMoonDir` and `uMoonPhase` as shared uniforms.

**Moonlight on the water**

- In `water.js`, add a second specular term for the moon on the top surface: `pow(max(dot(R, uMoonDir), 0), 300) * 4.0 * moonIntensity`. With the existing wave normals this breaks up into a glittering path toward the viewer.
- Use the same term at a much lower strength on the glass sides.

**Done when:** a sunset shot shows the orange disc on the horizon with long shadows pointing away from it, and a night shot shows the moon, a glitter path on the sea, and moon shadows matching the moon's side.

## Feature 2: night sky

Replace the backdrop's faint hashed stars with a fixed star catalogue drawn as points, a Milky Way band in the backdrop shader, and occasional shooting stars.

**Stars**

- Generate about 2,500 stars once with a seeded random generator (`mulberry32` from `src/core/noise.js`), uniformly on the upper hemisphere plus 10° below the horizon.
- Give each a magnitude: brightness `10^(-0.4 * mag)` with most stars faint (mag 3 to 6) and about 40 bright ones (mag 0 to 2). Tint 15% of them warm (orange) and 15% cool (blue-white).
- Draw them as a `THREE.Points` on a sphere of radius 1400 centred on the camera (like the backdrop), `depthTest: false`, `renderOrder: -9` so they sit just above the backdrop and behind everything else.
- Point size 1 to 3 px by brightness, independent of zoom. Twinkle: `0.75 + 0.25 * sin(uTime * (2 + h * 5) + h * 40)` per star, stronger near the horizon.
- Rotate the whole sphere slowly around a tilted pole (one turn per in-game day) so stars wheel across the night.
- Visibility: `smoothstep(0.35, 0.9, uNight) * (1 - uCloud)`, and fade near the horizon to suggest haze.

**Milky Way**

- In `backFrag`, define a band as a great circle tilted 60° to the horizon: `band = exp(-pow(dot(d, bandNormal) / 0.18, 2))`.
- Modulate it with `fbm` noise at two scales for clumps and dark dust lanes, colour a faint blue-white with a warmer core, strength 0.06 at full night. Rotate it with the star sphere.

**Shooting stars**

- At full night, roll a chance of one every 20 to 50 seconds (never in rain).
- Draw it as a short additive line (a stretched quad) crossing 15° to 30° of sky in 0.6 to 1.0 s, with a bright head and a fading tail.
- Optional: a very soft chime in the ambience at 10% volume.

**Done when:** the night view shows a believable star field with a visible Milky Way, stars fade in from about 19:15 and out by 5:20, and no stars are visible through clouds.

## Feature 3: the weather system

Create `src/world/weather.js` with a `Weather` class that holds a handful of continuous values. Every visual, sound and animal system reads only these values, never the state name, so transitions are always smooth.

**The values (all 0 to 1)**

| Value | Meaning | Clear | Cloudy | Rain | Storm |
| --- | --- | --- | --- | --- | --- |
| `cloud` | Sky cover; dims sun, hides stars and discs | 0.05 | 0.6 | 0.85 | 1.0 |
| `rain` | Rainfall rate | 0 | 0 | 0.6 | 1.0 |
| `wind` | Wind strength (Feature 6) | 0.2 | 0.35 | 0.5 | 0.9 |
| `fog` | Haze and spray in the air | 0 | 0.15 | 0.35 | 0.5 |
| `waves` | Sea roughness | 0.2 | 0.3 | 0.5 | 1.0 |
| `lightning` | Chance of strikes | 0 | 0 | 0 | 1 |
| `wet` | How wet surfaces are; not set by state | follows `rain` |  |  |  |

**Blending**

- Each frame, ease every value toward its target: `v += (target - v) * (1 - exp(-dt / tau))`. Use `tau = 8 s` for `cloud` and `fog`, 5 s for `rain`, 3 s for `wind`.
- `wet` builds while it rains (`tau = 15 s`) and dries slowly afterwards (`tau = 60 s`), so puddles and dark rock linger after a shower.
- Gusts: `gust` is a separate value, a smoothed random walk scaled by `wind`, so trees bend harder for a few seconds at a time.

**Auto mode (the default)**

- A simple weighted random walk between states, re-rolled every 90 to 180 in-game-scaled seconds.
- Weights from the current state: Clear to Cloudy 60%, stay Clear 40%. Cloudy to Clear 40%, Rain 40%, stay 20%. Rain to Cloudy 50%, Storm 20%, stay 30%. Storm to Rain 70%, stay 30%.
- Cap storms at 2 minutes. Rain only after at least 3 minutes of Clear since the last rain, so most of the time the island is sunny.
- The viewer picking a state turns Auto off until they pick Auto again.

**Lighting hooks in `Atmosphere.setTime()`**

- Multiply the sun or moon light intensity by `1 - 0.7 * cloud` and its colour toward grey by `cloud * 0.6`.
- Raise the hemisphere fill a little (`+0.08 * cloud`) and shift it toward grey-blue, so overcast light is soft and shadowless.
- Lower shadow strength with cloud: `shadow.intensity = 1 - 0.75 * cloud` (Three.js r186 supports per-light shadow intensity).
- Grey the backdrop toward a slate colour by `cloud`, and add `fog` as `scene.fog` (exponential, density `0.004 * fog`) so distant parts of the diorama soften.

**Publishing**

Write the values into shared uniforms each frame: `U.uCloud`, `U.uRain`, `U.uWet`, `U.uFog`, `U.uWindGust`, `U.uFlash`. Expose the object on `window.__isle.weather` for testing, and accept `weather: 'storm'` in `capture()` specs, which should snap all values to their targets.

## Feature 4: rain

Rain is five layers driven by `rain` and `wet`: falling streaks, splashes, ripples on water, wet surfaces and dimmed misty light. Keep the rain inside the diorama's footprint so it reads as weather in a glass case.

**Falling streaks**

- `src/world/rain.js`: one `InstancedMesh` of thin camera-facing quads (or `LineSegments`), 6,000 drops on high quality and 2,500 on low. Show only `rain * count` of them by setting `mesh.count`.
- Animate entirely in the vertex shader so the CPU does nothing per drop: each drop has a random start `(x, z)` inside the 100 × 100 slice and a phase. Its height is `top - mod(uTime * speed + phase * H, H)` with `top = 45`, `H = 75`, `speed = 38`.
- Slant every drop by the wind: offset x and z by `uWind * windStrength * 0.35 * fallDistance`, and orient the streak along its velocity. Streak length 0.9 units, width 0.03.
- Kill drops that have hit the ground or sea: sample the heightfield texture `data.height` (already a `DataTexture`) in the vertex shader and collapse the quad when the drop is below `max(terrain, 0)`.
- Shade as soft white at 25% opacity, brighter when backlit by the sun or lit by a lightning flash, with additive blending. Draw it in the sea pass after the water so it overlaps the glass correctly.

**Splashes**

- A second `Points` layer of 1,500 tiny splash sprites placed at random spots on the ground and the sea surface, each living 0.25 s on a looped timer: a small ring that expands and fades.
- On land, place them using the heightfield; skip spots under thick canopy (use the existing `SpatialHash` tree positions baked into a 64 × 64 "canopy" texture).

**Ripples on water**

- In `water.js` and `river.js`, add rain ripples to the surface normal: tile the surface with cells of 0.8 units, give each cell a random drop time, and add a ring wave `sin(20 * (r - age * 1.6)) * exp(-6 * age)` within each cell. Scale by `uRain`.
- Also flatten the sun specular slightly and raise roughness, since rain breaks up reflections.

**Wet surfaces**

- Terrain (`terrain.js`): `gWet = max(gWet, uWet * (1 - slope * 0.5))`. The shader already darkens albedo by up to 38% and drops roughness to 0.45 when wet.
- Puddles: where the terrain is flat (`wn.y > 0.97`) and a low-frequency noise is above 0.65, push roughness to 0.08 and blend the colour toward a dark mirror, scaled by `uWet`. Add ripple normals there too.
- Rocks, tree bark, palms and animals: add a small shared patch `applyWet(material)` that darkens diffuse by `0.3 * uWet` and lowers roughness by `0.4 * uWet`. Leaves get a little extra specular sheen instead.

**Light and air**

- Cloud already dims the light (Feature 3). Add `fog` haze, and raise the waterfall mist emission rate by `1 + 2 * rain`.
- Rivers: flow speed `× (1 + 0.6 * rain)` and slightly browner, siltier colour.
- Water drops on the front glass: optional. A few slow-running droplets drawn in screen space over the glass sides only, at very low cost.

**Sound**

- In `ambience.js`, add a rain bed: pink-ish noise through a high-pass at 400 Hz plus a band-pass at 3 kHz, gain `0.35 * rain`. Add soft random patters (very short filtered noise bursts) at `20 * rain` per second, panned randomly.

**Done when:** in Rain, drops fall slanted with the wind and stop at the ground, the sea and river ripple, rocks and paths look darker and glossy, and everything dries over about a minute after the rain stops.

## Feature 5: storms

A storm is heavy rain plus lightning, thunder and rough water. Lightning is the one event that animals react to instantly, so it is fired as an event as well as a value.

**Lightning strikes**

- While `lightning > 0.5`, schedule strikes at random intervals of 6 to 18 s.
- Each strike: a flash envelope `uFlash` that jumps to 1, decays over 0.25 s, and often re-flickers once or twice (2 to 3 short pulses within 0.4 s).
- The flash adds a cold white term to the hemisphere light and the backdrop (`+ 2.5 * uFlash`), and briefly boosts the directional light from a random high direction. Raise exposure by `0.6 * uFlash`.
- Draw a bolt in about one strike in three: a jagged polyline from above the diorama down to a high point (the peak or a tall tree), built by recursive midpoint displacement with one or two forks. Draw it as additive glowing quads, visible for the flash only. Bloom (already in the pipeline) does the glow.
- Emit `weather.on('strike', { position, distance })` so animals and sound can react.

**Thunder**

- Delay the thunder by `distance / 343 * 0.2` s (shortened for the miniature scale), clamped to 0.3 to 3 s.
- Synthesise it in `ambience.js`: low-passed brown noise (cut-off sweeping 900 Hz down to 120 Hz), a sharp crack for near strikes, then a long rumble with slow amplitude wobble, 3 to 6 s. Volume falls with distance.

**Rough water**

- In `water.js`, scale the three sine wave amplitudes by `0.6 + 1.8 * waves` and raise their speed by `1 + 0.5 * waves`, keeping the edge fade near the glass so the waterline still meets the glass cleanly.
- Shoreline foam: widen the foam band and raise its threshold by `waves`, and add whitecaps in open water where wave height plus noise passes a threshold.
- Darken and green the water tint slightly and raise in-scatter with `fog`, so the sea looks churned up.
- Waterfall and river: more spray, faster flow.

**Done when:** a storm shows flickering lightning that lights the whole diorama, an occasional bolt to the peak, thunder after each flash, whitecaps, and the light stays dim and moody between strikes.

## Feature 6: wind

Wind becomes one strength value (`weather.wind`, 0 to 1) plus a direction and travelling gusts. The plant sway already exists in `applyWind()`; it just needs to scale with strength and lean with the wind.

**Direction and gusts**

- Keep the direction in `U.uWind` (currently a fixed `vec2(0.8, 0.5)`). Let it drift by up to ±20° over a few minutes.
- Gust fronts: instead of the current per-plant `gust` sine, compute a wave travelling along the wind direction: `front = smoothstep(0.6, 1.0, sin(dot(instBase.xz, windDir) * 0.08 - uTime * 0.9 * (0.5 + wind)))`. Plants bend harder as each front passes, so you can see gusts sweep across the meadow and the bamboo.

**Plants (`src/veg/materials.js`)**

- Pass two new uniforms into `windChunk`: `uWindStrength` and `uWindGust`.
- Sway amplitude: `amp * (0.4 + 2.2 * strength) * (1 + gustFront)`.
- Lean: add a steady offset in the wind direction, `0.6 * strength^2 * bend`, so trees lean away from strong wind instead of just swaying around upright.
- Flutter frequency up by `1 + strength`.
- Per type, keep each material's own `amp` and `stiff`: trees stiff, bamboo and palms flexible, grass very flexible.

**Blowing leaves and petals**

- `src/world/leaves.js`: 400 small leaf and petal sprites recycled across the island, carried along the wind with turbulence (two noise octaves) and gravity. Spawn rate `strength^2`, so they only appear in real wind.
- Use the existing oak leaf texture at a small size, and petal colours from the meadow flowers.

**Water, birds and sound**

- Sea: wave amplitude `+ 0.6 * wind`, and normal-map scroll speed up by `1 + wind`.
- Rain slant: already uses wind (Feature 4).
- Birds: in strong wind, gulls hang and drift instead of looping (reduce path speed, add sideways drift).
- Sound: `windGain` already exists in `ambience.js`; set its level from `0.02 + 0.12 * wind` and add a whistle (narrow band-pass around 900 Hz) above `wind = 0.7`.

**Controls:** Calm (0.1), Breezy (0.4), Windy (0.75). In Auto, wind follows the weather table in Feature 3.

## Feature 7: animal reactions

Animals read the weather values and the strike event, and pick new actions from them. Reactions sit on top of the existing state machine in `Fauna.chooseAction()` and `Fauna.update()`, so normal life resumes on its own when the weather clears.

**Who does what**

| Animal | Rain | Lightning strike | Strong wind | Night |
| --- | --- | --- | --- | --- |
| Tiger | Walks to the nearest tree cover and lies down; shakes off after the rain stops | Flattens ears, crouches for 2 s, then looks toward the strike | Lies with its back to the wind | More active: walks and stalks more, rarely sleeps |
| Deer (stag, does, fawns) | Gather under the meadow birches, fawns close to a doe | Bolt 10 to 15 units away from the strike, then regroup | Head low, turn backs to the wind | Lie down together in the meadow; one stays alert, looking around |
| Brown bear | Ignores it and keeps fishing at the river; shakes off afterwards | Stands up on hind legs for a second, then carries on | No change | Sleeps curled near the riverbank |
| Giant panda | Curls up under the bamboo, still chewing | Startles, rolls onto its back, rights itself | Sits facing away from the wind | Sleeps curled up in the bamboo |
| Birds | Eagles and macaws land on tall trees; gulls ride it out low over the water | Any flying birds scatter, then land | Gulls hover and drift | Eagles and macaws roost in trees; gulls sit on the beach |
| Fish and reef fish | No change | School darts away from the surface, then reforms | No change | Reef fish tuck in close to their coral homes |
| Sharks, manta | Swim deeper in storms (`yFrac` lowered) | Brief speed burst | No change | No change |
| Turtles | Surface to breathe more often | No change | No change | Rest on the reef floor |

**Implementation**

- **Priority:** reactions override normal choices in this order: startle (lightning) > flee (tiger) > shelter (rain) > wind posture > night routine > normal life. Store `a.reason` so a lower priority never interrupts a higher one.
- **Shelter spots:** at start-up, bake a list of sheltered points per animal home: ground points within 2 units of a tree or bamboo clump, taken from the positions already stored in `SpatialHash`. `pickShelter(a)` returns the nearest free one, reusing `okSpot()`.
- **New poses in `src/creatures/gait.js`:** `crouch` (low body, head forward), `shake` (a 1 s full-body wobble: spine and neck yaw oscillating at 8 Hz, decaying), `sleep` (the `lie` pose with the head down on the front paws), `rear` (bear only: pelvis rotated up 1.1 rad, front legs forward), and an ears-back flag for tigers and deer.
- **Startle:** on a strike event within 40 units, every animal plays a short `crouch` or `rear` with a random delay of 0 to 0.2 s, so they don't move in sync. Deer then use the existing flee code, pointed away from the strike instead of the tiger.
- **Facing the wind:** while standing or lying in strong wind, ease `a.heading` toward the downwind direction.
- **Birds (`src/fauna/birds.js`):** add a `perched` mode per flock. Pre-pick perch points on the tops of tall trees (eagles, macaws) and on the beach (gulls). When `rain > 0.4` or at night, blend each bird from its flight path to a landing curve, fold its wings (`aFlap.y = 0` with wings rotated in), and hold it on the perch. Reverse when conditions clear.
- **Sea life (`src/sea/life.js`):** pass `weather` into `update()`. Storm: lower each big swimmer's `yFrac` range by 0.3. Strike: add an impulse away from the surface to every fish within 15 units of the strike's x and z. Turtles: every 40 to 70 s, pick a surface target and swim up, hold for 3 s, then dive.
- **Settling after the weather:** when the reason clears, wait 2 to 6 s at random, play `shake` if the animal was wet, then return to `chooseAction()`.

**Done when:** a storm visibly sends the deer and pandas to cover, a strike makes everything flinch at once and the deer bolt, the bear keeps fishing, birds land in rain, and every animal returns to its normal routine within a minute of clearing.

## Feature 8: natural motion

Motion is the biggest single gain in realism. Today `pose()` in `src/creatures/gait.js` swings each leg on a sine wave, and `Fauna.update()` moves the body at a steady speed, so feet slide and turns look mechanical. Replace that with feet that plant on the ground, gaits with weight, eased movement and secondary motion.

**Planted feet (foot IK)**

- Give each of the four feet a state: `stance` (locked to a world position) or `swing` (moving to the next footfall).
- During stance, the foot's world position stays fixed while the body moves over it. Lift it when the gait phase says so, then swing it along a short arc (height `0.12 × leg length`) to a predicted landing point: the hip or shoulder position projected forward by half a stride, dropped onto the terrain with `hf.heightAt()`.
- Solve each leg as two-bone IK every frame (`shoulder → elbow → wrist`, `hip → knee → hock`, the bone names already in the rig). Keep the knee bend direction fixed per joint: front elbows bend back, hind knees bend forward and hocks back.
- On slopes, pitch and lower the pelvis and chest to the average of their two feet heights, so animals walking uphill lean into it.
- Reference: the classic analytic two-bone solver (law of cosines) is enough; no physics engine is needed.

**Gaits with weight**

- Walk: four-beat (left hind, left fore, right hind, right fore), 60% stance. Trot: diagonal pairs, 45% stance. Gallop for fleeing deer: front pair then back pair with a short airborne phase.
- Pick the gait from speed with blending between them, and scale stride length and cadence by the animal's size so big animals step slowly.
- Body motion from footfalls: the pelvis dips on each hind footfall, the chest on each fore footfall, the spine twists slightly toward the leg in swing, and the head counter-bobs (deer and tigers keep their heads steadier than their bodies).
- Bears and pandas get a rolling, heavy walk: more side sway, shorter stride, toes slightly in.

**Eased movement**

- Replace the fixed turn clamp (1.6 rad/s) and instant speed with an acceleration model: speed eases toward the target with `accel = 1.2 units/s²`, and the turn rate shrinks as speed grows.
- Look before turning: the head turns toward a new target 0.3 s before the body follows.
- Steer along a smooth path (a Catmull-Rom curve through two or three waypoints) instead of straight at the target, and avoid trees and rocks using the existing `SpatialHash`.

**Follow-through**

- Add a tiny spring per secondary bone (each tail segment, ears, head, the bear's belly): `velocity += (target - angle) * k - velocity * damping`. Tails lag behind turns and swing on stops; heads overshoot slightly and settle.
- Run the springs at a fixed 60 Hz substep so they behave the same at any frame rate.

**Small behaviours (idle layer)**

- Random, overlapping micro-actions while idle, grazing or resting: blink (eyelid scale, every 2 to 6 s), ear flick, tail swish, sniffing the ground, scratching with a hind leg, shifting weight from foot to foot.
- Species extras: tiger yawn and stretch, deer head-up-and-listen freeze, bear sitting back on its haunches, panda rolling onto its back.
- Animals look at things: the nearest other animal, a bird flying over, or the camera when it comes close.

**Birds**

- Flight states: flap to climb, glide to cruise (wings held out, slight dihedral), bank into turns, flare and land. The flap rate and amplitude follow the climb rate.
- Add a wing fold for perching (needed by Feature 7 anyway).

**Done when:** in slow motion, a walking animal's feet stay locked on the ground while in contact, the body rises and falls with each step, tails and heads lag and settle naturally, and turns curve smoothly.

## Feature 9: animal detail

The land animals are sculpted in `src/creatures/land.js` from smooth-blended shapes, turned into meshes by `polygonize()` in `src/creatures/sculpt.js`, and coloured per vertex. Detail is limited by three things: the mesh resolution, markings stored as vertex colours (stripes and spots come out blotchy), and a plain material with no fur. Fix all three.

**Finer shapes**

- Faces: add brow ridges, eyelids (a thin shell over each eye that also lets them blink), nostrils (small subtracted shapes; `Sculpt` already supports `subtract: true`), lips and a chin, and hollow ear cups.
- Feet: separate toes on tiger, bear and panda paws (four small ellipsoids plus claws for the bear); split hooves and dewclaws on the deer.
- Bodies: shoulder blades and hip bones for the tiger and deer, a neck ruff and cheek fur for the tiger, a fuller shoulder hump for the bear, rounder belly and ears for the panda.
- Resolution: sculpt at a finer cell size (0.022 to 0.028 instead of 0.032 to 0.045), then smooth with two passes of Taubin smoothing and simplify back to about 20,000 triangles with a quadric decimator. Keep a second, 5,000-triangle version for far views and switch by distance (a simple level-of-detail swap).

**Markings in the shader, not the vertices**

- Move the colour patterns out of the per-vertex `paint` functions into the fragment shader, so stripes and spots are sharp at any distance.
- Store a few values per vertex instead (the part id and a position in the animal's rest pose) and compute markings from the rest position in the shader. Tiger stripes: tapered stripes following the body's girth using noise-warped bands. Deer spots: two rows of soft-edged dots along the flank. Panda: the existing patch rules, with soft edges.
- Add colour variation: darker along the spine, lighter belly and inner legs, slight noise so no two areas match.

**Fur**

- Shell fur for close views: draw each animal 12 to 16 extra times as slightly inflated shells, each discarding pixels where a hair-noise texture is below its height. This gives real soft fur edges and is a well-known, cheap technique. Fade the shells out beyond 30 units so distant animals cost nothing extra.
- Comb direction: offset the shells along the body toward the tail and downward, so fur lies flat.
- Lighting: keep the current sheen, add a rim light term so the fur edges glow against the sun (very effective at golden hour).

**Eyes**

- Make eyes separate small glossy spheres with an iris colour, a dark pupil and a bright specular highlight (roughness 0.05). A catchlight in the eye is what makes animals feel alive.

**Done when:** a close-up of each animal holds up next to the concept image: readable faces with eyes that catch the light, clean stripes and spots, soft fur edges, and toes or hooves on every foot.

## Feature 10: trees and plants

Trees come from `src/veg/treegen.js` (five species, two or three shape variants each, leaf cards with 512 px leaf textures), instanced by `src/veg/trees.js`. Bamboo, palms, ferns and flowers use small canvas-painted textures. Most of the gain comes from more variety, light that falls off inside the canopy, and texture detail on bark and leaves.

**Variety**

- Five or six shape variants per species instead of two or three (generation is fast; cost is only memory), plus per-instance colour and size variation that already exists.
- New species for the jungle: a tall broadleaf canopy tree with buttress roots and a flat crown, and a strangler fig with hanging aerial roots. For the meadow edge: a flowering tree (white or pink blossom cards). For the slopes: a few dead snags and fallen logs.
- Lianas: curved tubes hanging between jungle trees, with small leaf cards along them.

**Canopy light**

- Darken leaves toward the inside of each crown: compute a per-vertex "depth into crown" when the tree is generated (distance from the crown's outer hull) and darken by up to 50%. This single change makes canopies look full instead of flat.
- Leaf colour variation per card (hue ±6%, brightness ±15%), a few yellowed or reddish leaves, and a lighter underside when the leaf is backlit.
- Leaf flicker: a high-frequency rotation per card in the vertex shader, scaled by wind (Feature 6).

**Textures**

- Leaf textures at 1024 px with a matching normal map; add 2 to 3 leaf textures per species so neighbouring cards differ.
- Bark: add roughness and AO maps (already in the EZ-Tree asset set) and moss on the upward-facing side of trunks and branches near the ground (shader mix by normal and noise).
- Trunk base: flare the bottom section of each trunk and add 3 to 5 root tubes into the ground.

**Bamboo and palms**

- Bamboo: thinner culms with visible node rings and sheaths, older yellowish culms mixed in, leaf sprays with 3 to 5 narrow drooping leaves drawn at higher resolution.
- Palms: split and ragged fronds, a few dead brown fronds hanging under the crown, a coconut cluster, and a fibrous texture where the fronds meet the trunk.

**Ground layer**

- Grass: more blades per tuft (15 to 20) with a dry tip colour, denser near paths and the river.
- Flowers: three proper shapes (daisy, bell, small cluster) instead of one, with stems that bend.
- Forest floor: fallen leaves and pine needles as a decal texture under trees, mushrooms, mossy logs, ferns that curl at the tip.
- Keep the existing distance fade, so the extra ground detail costs nothing far away.

**Done when:** close views of the forest and jungle read as dense, layered and varied, with no two neighbouring trees identical, and the far overview looks the same or better at the same frame rate.

## Feature 11: sea creatures

Fish, sharks, the manta and turtles are sculpted in `src/creatures/sea.js` the same way as the land animals, and animated in the vertex shader by `src/sea/life.js` (a sine wave along the body, a wing wave for the manta, flipper rotation for turtles). Upgrade their shapes, surfaces and swimming.

**Shapes**

- Fish bodies: replace the generic two-ellipsoid body with a per-species side profile (a 2D outline curve per species, extruded with a rounded cross-section). Tangs and angelfish become properly disc-shaped, clownfish rounder, scad slim and torpedo-shaped.
- Add a mouth, a gill cover edge and a raised lateral line. Give fins rays: thin ribs on each fin.
- Shark: a sharper snout, a defined gill region, a rougher and more pointed tail, a mouth line under the head.
- Manta: thinner wings with a curved leading edge, head fins that curl, and gill slits on the underside.
- Turtle: a domed shell with distinct scutes as raised geometry, a beak, and scaled skin on the head and flippers.

**Surfaces**

- Scales in the shader: a small overlapping scale pattern in each fish's rest-pose coordinates, catching the light as the body bends.
- Shimmer: silver fish and tangs use `MeshPhysicalMaterial` with `iridescence` (supported in Three.js), so the school flashes as it turns. Silver fish get a strong mirror-like reflection of the water colour on their flanks.
- Translucent fins: draw fins as a separate mesh with alpha 0.5 to 0.7 and a back-light term, so sunlight shines through them.
- Markings move from vertex colours into the shader for sharp edges (as for the land animals).

**Swimming**

- Body wave by swimming style: tuna-like for scad and sharks (the wave mainly in the rear third), side-to-side with the whole body for clownfish, and fin-driven for tangs and angelfish (body nearly still, pectoral fins rowing).
- Bend into turns: curve the whole body by the current turn rate, so fish arc rather than pivot.
- Burst and glide: reef fish swim in short bursts then coast with fins out; sharks swim in long slow beats with glides between.
- Fin motion: pectoral fins flutter while hovering, the dorsal fin sways a little behind the body wave.
- Manta: the wing wave travels from front to back and from root to tip with a delay, with occasional slow barrel rolls.
- Turtles: power strokes with the front flippers, rear flippers steer, the head lifts on each stroke, and they glide between strokes.
- Schools: use a spatial grid for the flocking so the school can grow to 300 fish on laptops. When a shark passes, the school splits around it and reforms (a moving gap), instead of scattering evenly.

**Done when:** a close view through the front glass shows species you can recognise by shape alone, flashing scales on the school, light through fins, and swimming that bends and coasts rather than wiggling at a steady rate.

## Optional: professionally made animal models

Code-built animals will top out as very good miniature figurines. For lifelike fur, faces and motion, swap in rigged, animated models made by artists, and keep the sculpted animals as a fallback.

- **What to get:** one rigged model per species (tiger, sika or similar deer, brown bear, giant panda, reef shark, manta ray, sea turtle, and two or three reef fish), each with at least idle, walk, run and one rest animation (lie, sit or graze).
- **Where:** free models with CC0 or CC-BY licences from Sketchfab (filter by Downloadable and Animated), Poly Pizza, or Quaternius; or a paid pack for consistent quality. Credit CC-BY authors in the About panel.
- **Format and size:** glTF binary (`.glb`), under 20,000 triangles and 2 MB each after compression. Use Draco or Meshopt mesh compression and KTX2 textures (the `gltf-transform` command-line tool does all three).
- **Loading:** `GLTFLoader` with `DRACOLoader` or `MeshoptDecoder`; play clips with `AnimationMixer` and cross-fade between them by the agent's state.
- **Keeping the behaviour:** the agents in `src/fauna/animals.js` stay the same. Map their states to clips (`walk` to the walk clip with playback speed matched to ground speed, `graze` to graze, and so on). Foot IK from Feature 8 can still run on top of the clips if the rigs' bone names are mapped.
- **Effort:** about 1 day per species to clean up, compress and hook up, assuming the models come rigged and animated.

## UI and controls

Add one weather button to the existing bottom dock (`index.html`, `src/ui/hud.js`) that opens a small panel, rather than more buttons in the dock itself.

- **Dock button:** an icon that shows the current weather (sun, cloud, rain, storm) with a small "A" badge when Auto is on. Place it next to the sound button in the time group, so it fits the phone layout's first row.
- **Panel:** a small glass card above the dock, like the info card. Two rows of segmented buttons:
  - Weather: Auto, Clear, Cloudy, Rain, Storm.
  - Wind: Auto, Calm, Breezy, Windy.
- **Status line in the clock:** replace the time-of-day word with the combined state when not clear, for example "Rain · Dusk" or "Storm · Night".
- **Accessibility:** buttons are real `<button>` elements with `aria-pressed`; the panel closes with Escape and on outside click; the current weather is announced through the clock's text.
- **Reduced motion:** if `prefers-reduced-motion` is set, Auto starts off, lightning flashes are softened to 30% and bolts are not drawn.
- **Deep links (optional):** `#rain`, `#storm` and `#night` as plain anchors set the starting state, useful for sharing a moment.
- **Persistence:** remember the last chosen weather in `localStorage`, wrapped in try/catch; the page must work without it.

The About panel's text should gain one line: "Weather changes on its own; tap the cloud button to choose it."

## Performance budgets and quality tiers

The scene already draws about 2 million triangles per pass and around 200 draw calls, so the new features must be cheap: mostly shader work and a few instanced layers, with no per-particle CPU work.

| Item | High (laptop) | Low (phone) | Budget |
| --- | --- | --- | --- |
| Rain streaks | 6,000 | 2,500 | 1 draw call, GPU-animated |
| Splashes | 1,500 | 600 | 1 draw call |
| Stars | 2,500 | 1,200 | 1 draw call |
| Blowing leaves | 400 | 150 | 1 draw call |
| Lightning bolt | up to 300 quads | up to 120 quads | 1 draw call, only during flashes |
| Rain ripples | in the water shader | in the water shader, half the cells | under 0.3 ms GPU |
| Puddles and wetness | in existing shaders | in existing shaders | no extra passes |
| Total added |  |  | under 8 draw calls, under 2 ms GPU on a laptop |

**Rules**

- No new render passes. Rain and lightning go in the sea pass that already draws after the opaque scene; stars and the Milky Way go in the backdrop.
- Particles never cast shadows.
- Regenerating the environment map is the most expensive thing `Atmosphere` does. Keep its existing "only when the sun moved noticeably" rule, and do not regenerate it for cloud or lightning changes; use `scene.environmentIntensity` instead.
- The existing `govern()` will lower resolution in heavy storms on slow devices; that is acceptable.
- On low quality, skip splashes on land, halve ripple cells, and cap lightning to one flash per strike.

**Budgets for the detail work (Features 8 to 11)**

The detail upgrades add triangles and fragment cost, so each one comes with a level-of-detail rule.

| Item | High (laptop) | Low (phone) | Rule |
| --- | --- | --- | --- |
| Land animal mesh | 20,000 triangles near, 5,000 far | 5,000 triangles | Swap by camera distance (30 units) |
| Shell fur | 12 to 16 shells | off | Only within 30 units of the camera |
| Foot IK and springs | all 12 animals | all 12 animals | CPU only, about 0.2 ms per frame |
| Tree variants | 5 to 6 per species | 3 per species | Memory only, no extra draw calls per tree |
| Leaf textures | 1024 px with normal maps | 512 px, no normal maps | Chosen at load time |
| Fish mesh | about 1,500 triangles | about 600 triangles | Silver school uses the low mesh on all devices |
| Fish school | 300 | 120 | Spatial grid keeps flocking under 1 ms |
| Translucent fins | separate fin mesh | merged into body | One extra draw call per species |

Target for the whole upgrade: the overview stays at or under 2.5 million triangles per pass on high quality, and draw calls stay under 260.

## Testing and acceptance checklist

Check each feature with stills from the existing capture harness, then with a live run on a real laptop and phone. Extend `capture()` so a spec can set `weather`, `wind` and `moonPhase` and snap them instantly.

**Stills to capture** (`node scripts/shot.mjs` with JSON specs)

- [ ] Overview at 12:30, 17:30, 18:40 and 22:30, clear: sun or moon disc visible and shadows pointing away from it
- [ ] Night with moon phases 0, 0.25 and 0.5: dark, half and full moon; moon glitter path on the sea at full
- [ ] Night, clear: star field and Milky Way visible; night, cloudy: no stars
- [ ] Rain at 16:00, overview and Meadow view: slanted drops stop at the ground; ripples; dark glossy rock and paths
- [ ] Storm with `uFlash` forced to 1: whole scene lit, a bolt to the peak
- [ ] Storm, Reef view from the front glass: rough surface seen from below, whitecaps, dimmed water
- [ ] Windy: trees visibly leaning downwind in a still frame
- [ ] Phone size (390 × 844): weather panel fits, nothing scrolls sideways

**Live checks**

- [ ] Auto mode runs for 20 minutes without getting stuck in a state, and storms never last over 2 minutes
- [ ] Switching Clear to Storm and back has no pops: light, water, sound and plants all ease
- [ ] Rain stops, then surfaces dry over about a minute
- [ ] A strike makes all animals flinch with slightly different timing; deer bolt away from it; thunder follows the flash
- [ ] Deer, pandas and tigers reach shelter within 15 s of rain starting and return to normal within a minute of it clearing
- [ ] Birds land in rain and take off again after
- [ ] `scripts/interact.mjs` extended to click every weather and wind button: no console errors or warnings
- [ ] Frame rate: 60 fps on a recent laptop in Storm, 30 fps on a mid-range phone; draw calls increase by under 8
- [ ] Sound: rain and thunder only after the sound button is pressed; mute stops everything
- [ ] Reduced motion on: Auto off, soft flashes, no bolts

**Detail and motion checks**

Use `lab.html` for close-ups of single animals and fish, and record short screen captures at 25% playback speed to judge motion.

- [ ] Each land animal walking on flat ground and on a slope: feet do not slide while planted, the body leans into the slope
- [ ] Walk, trot and gallop blend without pops when speed changes; deer gallop when fleeing
- [ ] Tails and heads lag on turns and settle after stops; turns follow curves, not pivots
- [ ] Idle animals blink, flick ears and shift weight at irregular intervals, never in sync with each other
- [ ] Close-up of each animal's face: eyes with a catchlight, nostrils, eyelids; stripes and spots sharp; fur edge soft against the sky
- [ ] Far overview: animals switch to the low-detail mesh with no visible pop
- [ ] Forest and jungle close-ups: no two neighbouring trees identical, crowns darker inside, moss and roots at trunk bases
- [ ] Reef close-up through the glass: each fish species recognisable by outline; scales flash on turns; sunlight shows through fins
- [ ] School splits around a passing shark and reforms
- [ ] Overview at or under 2.5 million triangles per pass and 260 draw calls on high quality (check with `renderer.info`)

## Suggested build order and effort estimates

Build in this order, because each step gives the next one something to react to. Total: about 30 to 38 developer-days for one experienced Three.js developer (13 to 17 for sky and weather, 17 to 21 for detail and motion), shippable after each step.

1. **Weather core and controls** (2 days): `Weather` class, blending, Auto mode, shared uniforms, dock button and panel, `capture()` support. Nothing visible changes yet except the light dimming with cloud.
2. **Sun and moon** (1.5 days): discs, moon arc and phases, light from the moon's real direction, moon glitter on the sea.
3. **Night sky** (1 day): star field, Milky Way, shooting stars, cloud hiding them.
4. **Wind** (1.5 days): strength and gust fronts in `applyWind()`, leaning, blowing leaves, wind-driven waves and sound.
5. **Rain** (3 days): streaks, splashes, ripples, wetness and puddles, mist, rain sound.
6. **Storms** (2 days): lightning flashes and bolts, thunder, rough water and whitecaps.
7. **Natural motion** (5 to 6 days): foot IK and planted feet, gaits with weight, eased steering, follow-through springs, idle behaviours, bird flight states. Do this before the animal reactions so the new poses are built on the new motion system.
8. **Animal reactions** (3 to 5 days): shelter spots, new poses, startle, wind posture, night routines, perching birds, sea life changes. Start with deer and birds, which read best on screen.
9. **Animal detail** (4 to 5 days): finer sculpts with faces, toes and hooves, markings in the shader, shell fur, glossy eyes, near and far meshes.
10. **Trees and plants** (3 to 4 days): more variants and species, canopy darkening, better leaf and bark textures, moss and roots, bamboo, palm and ground-layer upgrades.
11. **Sea creatures** (4 to 5 days): per-species body profiles, scales and iridescence, translucent fins, swimming styles, school splitting.
12. **Tuning and testing** (1 to 2 days): the checklists above on a laptop and a phone, then balance Auto mode so the island is mostly sunny.
13. **Optional: artist-made models** (about 1 day per species): see the optional section.

With two developers, one can take the sky and weather (steps 1 to 6) while the other takes motion and detail (steps 7, 9, 10 and 11); they meet at step 8, which needs both the weather and the new motion system.
