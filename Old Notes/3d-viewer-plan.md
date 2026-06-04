# 3D Viewer Plan

## Purpose

Define the target 3D viewer experience from the end user's perspective first, then work backward into loading, rendering, asset, and implementation requirements for the current WoodLab Configurator app.

This plan assumes the existing project constraints remain in place:

- Client-only static app
- Vanilla JS + Three.js
- Local repo data/assets by default
- No new dependencies
- Shared app state remains owned by `js/state.js`, with app-level mutations handled by `js/main.js`

## Current Problem

The left-hand viewer area is currently not communicating anything useful to the user. In practice it appears as blank space, even though the app structure and viewer module already exist.

Before real 3D model loading is added, the viewer must always render one of these visible states:

1. Empty-state guidance
2. Loading state
3. Interactive 3D model
4. Fallback image or simplified placeholder model
5. Error state with recovery action

Blank space is not an acceptable viewer state.

## End-User Goal

The viewer should feel like the visual anchor of the configurator:

- The selected table is always visible on the left.
- The model updates as the user makes choices.
- The user can rotate, zoom, and reset the view without needing instructions every time.
- The viewer never collides visually with the floating footer bar.
- If a high-fidelity model is not ready for a given configuration, the user still sees a meaningful fallback instead of an empty panel.

## Intended User Experience

### 1. Initial State

When the user first lands in the configurator:

- The viewer shows a branded empty state, not a blank box.
- The empty state includes a short message such as "Choose a model to begin".
- A subtle static illustration or low-cost placeholder table silhouette is visible.
- A small helper caption can say "Drag to rotate once a model is loaded".

### 2. After Model Selection

When the user selects a model:

- The viewer transitions from empty state to loading state immediately.
- The selected table appears centered and scaled correctly within the frame.
- The default camera angle should be a flattering 3/4 perspective, not a strict front view.
- The object should sit on a ground plane or soft shadow plane so it feels anchored.

### 3. During Configuration

As the user changes design, wood species, finish, dimensions, legs, or add-ons:

- The model updates progressively rather than reinitializing the whole viewer.
- Camera position stays stable unless the user presses reset.
- Changes that affect geometry update geometry.
- Changes that affect appearance update materials/textures.
- Changes that do not yet have a dedicated 3D representation should update supporting UI copy or show a compatibility badge rather than silently doing nothing.

### 4. Viewer Controls

The user should have lightweight, obvious controls:

- Drag: orbit around the table
- Scroll / pinch: zoom
- Right-drag or modifier-drag: pan
- Reset View: return to the default 3/4 framing

Controls should be visible but secondary. They should live inside the viewer chrome and remain above the footer safe zone.

### 5. Error and Fallback Behavior

If a model asset fails to load:

- Show a fallback simplified model or curated image for that selection
- Present one short status line such as "3D preview unavailable for this option"
- Keep the reset control and the rest of the configurator usable

## Layout and Safe-Area Rules

The viewer must respect the floating footer bar across desktop and mobile layouts.

### Required rule

No interactive viewer content may sit underneath the footer bar.

### Practical implications

- The visible 3D framing area must end above the top edge of the floating footer.
- Viewer controls must sit above the footer, not behind it.
- Any loading overlay, caption, badge, or toast inside the viewer must also respect that same lower safe area.
- The viewer should use an explicit bottom safe inset derived from the existing footer variables, rather than assuming the footer does not overlap content.

### Recommended implementation rule

Define a viewer safe-bottom spacing token based on:

- `--footer-height`
- `--footer-floating-gap`
- extra visual breathing room of 12px to 24px

That safe-bottom value should be used consistently for:

- viewer canvas framing
- overlay positioning
- control positioning
- tooltip positioning

## Visual Design Target

The viewer should feel premium but restrained:

- Soft neutral background behind the model
- Ground shadow or matte floor plane
- No harsh black void
- No debug-looking axes or wireframes in user mode
- Gentle motion only when the user interacts

The model should be the focal point, not the controls.

## Rendering Plan

### Scene

Keep one persistent Three.js scene instance for the session.

- Initialize the renderer once
- Initialize camera once
- Initialize controls once
- Reuse scene graph nodes when selections change

This matches the older viewer guidance already present in repo notes and avoids unnecessary flicker.

### Measurement convention

Use inches as the canonical model-space convention for this project.

- Exported `.glb` assets should be authored and handed off with inch-based dimensions.
- Viewer integration should assume inches when validating scale and expected overall size.
- If any normalization step is needed in code, it should preserve the inch-based convention rather than switching the project to meters.

### Camera

Use a single perspective camera with:

- default 3/4 angle
- sensible min/max zoom
- damping enabled
- reset target stored centrally

Reset should restore:

- camera position
- controls target
- zoom level

### Lighting

Use a lightweight product-viewer setup:

- ambient or hemisphere light for base visibility
- one main key directional light
- one softer fill light
- optional rim or back light for edge separation

The goal is clarity and material readability, not photorealism.

### Grounding

Use one of:

- a soft ground plane with subtle shadow
- a fake contact shadow under the table

This is important because furniture floating in empty space looks broken even if the model itself loads correctly.

## Model Representation Strategy

For the first working implementation, the viewer should load local `.glb` assets directly.

Use local `.glb` assets for supported model families.

Use imported assets when:

- silhouette matters
- leg systems are distinct
- dimensions need believable scaling
- premium finishes benefit from real geometry

### Core implementation rule

Do not create one full exported model for every possible configuration.

That would create too many assets, make maintenance expensive, and slow down iteration.

Instead, use a hybrid model strategy:

- swap the whole base `.glb` only when silhouette changes significantly
- swap parts when a component changes
- swap materials when appearance changes
- keep low-visual-impact options out of 3D when needed

### Practical decision rules

Use a different base `.glb` when:

- the overall table silhouette changes substantially
- the design family is visually different enough that part-swapping would be brittle
- a model needs a fundamentally different layout or river composition

Use part swapping when:

- legs or base assemblies change
- a component can be isolated cleanly as its own mesh or group
- the tabletop remains the same family but supporting structure changes

Use material swapping when:

- the geometry stays the same
- the user is changing wood species, resin color family, metal finish, sheen, or similar surface properties

Keep an option out of 3D when:

- the option has little visible impact
- the option would require disproportionate asset work for low user value
- the option is better represented in summary/specification output than in the viewer

## Asset Loading Plan

### Preferred asset format

Use `.glb` as the only runtime format.

Why:

- compact single-file delivery
- native fit for Three.js loaders
- materials, transforms, and meshes travel together
- easier static hosting than multi-file formats
- keeps the first implementation narrow and predictable

### Source of truth

Create a local viewer manifest that maps configurator selections to `.glb` assets and render rules.

Suggested file:

- `data/viewer-models.json`

Each entry should define:

- configurator model id
- asset path to a `.glb`
- default camera framing values
- scale normalization values
- supported material overrides
- supported leg/base variants
- known limitations if needed

### Loading flow

1. User changes a selection.
2. `js/main.js` updates canonical app state.
3. Viewer receives normalized selection data.
4. Viewer resolves the correct `.glb` asset from the manifest.
5. Viewer shows loading state immediately.
6. Viewer updates existing scene nodes or loads the required asset.
7. Viewer swaps in the finished representation without rebuilding the entire renderer.

## Import Pipeline Plan

Imported 3D assets should be prepared before entering the repo.

### Import requirements for each `.glb`

- pivot placed sensibly near the table center
- model oriented consistently
- real-world scale in inches
- baked transforms where possible
- unnecessary cameras/lights removed
- material slot names kept stable
- mesh names kept stable for later targeting

### Naming convention

Use predictable asset names such as:

- `assets/models/coffee-table-base.glb`
- `assets/models/dining-table-rounded.glb`
- `assets/models/conference-table-island.glb`

### Material override strategy

Imported models should support selective material replacement so the app can swap:

- wood tone
- resin color family
- metal leg finish
- glass or lighting accents where applicable

This means imported assets should be authored with stable mesh/material separation instead of one merged material across the whole model.

### Material standards

Material swapping should be treated as a supported core feature, not a special-case hack.

Required standards:

- meshes that may change appearance must have stable material assignments
- material slot names must be predictable across models
- tabletop, resin, metal base, and accent materials should be separated where applicable
- avoid collapsing the entire model to one material if multiple finish regions exist

Recommended material slot patterns:

- `mat/tabletop_wood`
- `mat/river_resin`
- `mat/leg_metal`
- `mat/glass`
- `mat/accent_light`

### Texture standards

Material swaps may use real textures, not just flat color changes.

Recommended approach by surface type:

- tabletop hero surfaces: use proper UV-unwrapped textures authored for that mesh
- resin/river surfaces: use proper UV-unwrapped textures or maps when the pattern is part of the design
- metal legs/bases: tileable textures are acceptable and often preferable
- subtle roughness/noise/detail overlays: tileable textures are acceptable

Texture rules:

- textures do not need to be tileable if they are uniquely UV-mapped to the target mesh
- textures should be tileable when they are intended to repeat across scalable or reusable surfaces
- avoid relying on tileable textures alone for premium wood tabletop visuals if a unique mapped texture is available
- prefer consistent texture resolution ranges across comparable assets

### Mesh separation standards

To support part and material swapping correctly, exported `.glb` models should separate the scene into logical runtime-editable regions.

Required mesh separation where applicable:

- tabletop
- river/resin area
- leg/base assembly
- optional add-on meshes that may toggle on/off

Recommended:

- separate left/right or front/rear leg groups if independent placement is needed
- separate glass and lighting elements from wood and metal geometry
- keep decorative or non-configurable details grouped under stable parent nodes

### Simplicity rule for first implementation

Do not build a multi-format asset pipeline yet.

- no `.gltf`
- no `.obj`
- no `.fbx`
- no runtime format fallbacks

If a `.glb` cannot be loaded, show an error state in the viewer rather than switching to another asset format.

## Rendering Update Rules By Selection Type

### Model selection

- Can swap the entire base `.glb`
- Resets camera framing only on the first selection or explicit reset

### Design selection

- May swap the top silhouette, river layout, or edge treatment
- Should not destroy the existing viewer session

### Material / color / finish

- Prefer material updates over model reloads
- If a finish has no exact shader treatment yet, approximate it with roughness/metalness adjustments and a clear user-neutral presentation

### Dimensions

- Scale only the supported axes
- Keep proportions believable
- Prevent impossible stretching on complex imported meshes
- If a given asset cannot scale safely, use variant-specific `.glb` files instead of procedural geometry

### Dimension strategy

Because the supported size range can span several multiples between smallest and largest options, naive whole-model scaling is not acceptable as the long-term solution.

Preferred order of implementation:

1. controlled part-based scaling and repositioning
2. size-bucketed `.glb` variants with limited scaling inside each bucket
3. full base-model replacement for designs that cannot survive scaling cleanly

### Dimension handling rules

Scale only the parts that are supposed to grow:

- tabletop width
- tabletop length
- river width or placement where the design supports it

Reposition parts that should spread apart instead of becoming thicker:

- left/right legs
- front/rear legs
- base supports
- islands or structural supports

Do not proportionally scale parts that should keep their physical thickness:

- leg thickness
- metal tube profile thickness
- edge profile thickness
- hardware and attachment elements

If a model breaks visually outside a safe scaling range:

- do not stretch it further
- route that size range to a different `.glb`
- document that limit in the viewer manifest

### Size-bucket guidance

When a single asset cannot cover the whole dimensional range convincingly, split it into size families.

Example approach:

- small
- medium
- large
- conference

Each family can then support only a controlled amount of scaling before the viewer switches to another `.glb`.

### Legs and base

- Swap leg assemblies independently when possible
- Keep tabletop and base as separate nodes in the scene graph

### Add-ons

- Support visibility toggles for items with clear geometry
- Use badges or summary-only representation for options that do not need visible 3D treatment yet

## Recommended Scene Graph Structure

Use a stable object hierarchy such as:

- root
- tabletop-group
- river-group
- base-group
- addon-group
- ground-group

This will make partial updates much easier than treating each configuration as one monolithic asset.

## Interaction Rules

### Orbit behavior

- Orbit around the product center
- Keep the table upright
- Disable upside-down camera flips
- Damping on by default

### Zoom behavior

- Limit zoom-in to avoid clipping through the mesh
- Limit zoom-out to avoid losing the product in empty space

### Pan behavior

- Allow mild pan
- Clamp extreme panning so the model cannot be lost off-screen

### Reset behavior

Reset must be deterministic and instant.

The user should always know what "home view" means.

## Accessibility and Messaging

The viewer is visual, but it still needs accessible support:

- Keep keyboard focus available for viewer controls
- Maintain visible focus states
- Add a polite live region for viewer status updates such as loading, preview updated, or fallback shown
- Give the canvas a meaningful ARIA label
- Keep help copy concise and practical

Recommended status messages:

- "3D preview loading"
- "3D preview updated"
- "Fallback preview shown"
- "3D preview unavailable for this option"

## Architecture Fit With Current App

To stay aligned with current repo rules:

- `js/state.js` remains the canonical state store
- `js/main.js` remains responsible for app-level state mutation
- stage modules continue dispatching events rather than mutating global state directly
- viewer code should react to normalized state changes, not own business logic

Recommended viewer responsibilities:

- asset resolution
- scene lifecycle
- representation swapping
- camera and controls
- viewer status events

Recommended non-viewer responsibilities:

- selection decisions
- pricing
- stage gating
- compatibility rules

## Viewer Standards Summary

The current agreed standards for the first implementation are:

- inches are the canonical unit convention
- `.glb` is the only runtime model format
- the viewer should not use model-format fallbacks
- full model swaps are for major silhouette changes
- part swaps are for leg/base/component changes
- material swaps are for appearance-only changes
- low-impact options do not need forced 3D representation
- dimensional changes must avoid naive whole-model scaling across the full range

## Suggested Delivery Phases

### Phase 1: Fix visible experience

- Ensure the viewer always shows a visible empty state
- Ensure the controls and overlays stay above the floating footer
- Add explicit loading and error states
- Replace the current blank state with a real viewer-ready empty state

### Phase 2: Stable `.glb` loading

- Support orbit, zoom, pan, and reset reliably
- Load one `.glb` per supported selectable model
- Normalize camera framing and model placement

### Phase 3: Asset manifest

- Add `data/viewer-models.json`
- Resolve selections to a `.glb` path
- Normalize camera framing and scaling rules per model

### Phase 4: Expanded GLB support

- Expand local `.glb` coverage for priority models
- Implement targeted material overrides
- Keep unsupported cases explicit in UI instead of adding alternate asset pipelines

### Phase 5: Richer configuration fidelity

- Leg assembly swaps
- dimension-aware geometry strategies
- add-on visibility
- more accurate material response

## Definition of Done

The viewer is ready when all of the following are true:

- The left panel is never blank
- The user always sees a meaningful preview state
- The viewer and its controls remain clear of the floating footer bar
- A selected model appears centered and interactable
- Reset reliably returns to the default framing
- Unsupported options degrade gracefully
- Viewer updates do not rebuild the whole app or break stage flow

## Immediate Next Implementation Target

Start with Phase 1 and Phase 2 using real `.glb` assets, not a multi-format fallback system.

That means the next practical engineering target is:

1. Make the viewer visibly render an empty state, loading state, and error state at all times.
2. Reserve a real bottom safe area above the floating footer for the viewer and its controls.
3. Load a single local `.glb` successfully in the viewer with stable framing and controls.
4. Add a manifest-driven path for `.glb` asset mapping instead of coupling asset logic directly to stage UI code.
