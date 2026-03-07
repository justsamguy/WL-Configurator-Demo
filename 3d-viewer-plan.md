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

The viewer should support three representation levels so the app can ship incremental value.

### Level 1: Guaranteed fallback

Always available for every supported model:

- simple procedural table geometry built in Three.js
- table top
- legs / base
- basic proportions per model family

This ensures the viewer never goes blank.

### Level 2: Curated static previews

Use curated local images when a model or option exists visually in marketing assets but not yet as a 3D mesh.

Use this for:

- complex one-off designs
- options without modeled geometry
- temporary fallback during migration

### Level 3: Real imported 3D assets

Use local `.glb` assets for supported model families once ready.

Use imported assets when:

- silhouette matters
- leg systems are distinct
- dimensions need believable scaling
- premium finishes benefit from real geometry

## Asset Loading Plan

### Preferred asset format

Use `.glb` as the primary runtime format.

Why:

- compact single-file delivery
- native fit for Three.js loaders
- materials, transforms, and meshes travel together
- easier static hosting than multi-file formats

### Source of truth

Create a local viewer manifest that maps configurator selections to viewer assets and render rules.

Suggested file:

- `data/viewer-models.json`

Each entry should define:

- configurator model id
- asset type: procedural, image, or glb
- asset path
- default camera framing values
- scale normalization values
- supported material overrides
- supported leg/base variants
- unsupported option notes if needed

### Loading flow

1. User changes a selection.
2. `js/main.js` updates canonical app state.
3. Viewer receives normalized selection data.
4. Viewer resolves the correct representation from the manifest.
5. Viewer shows loading state immediately.
6. Viewer updates existing scene nodes or loads the required asset.
7. Viewer swaps in the finished representation without rebuilding the entire renderer.

## Import Pipeline Plan

Imported 3D assets should be prepared before entering the repo.

### Import requirements for each `.glb`

- pivot placed sensibly near the table center
- model oriented consistently
- real-world-ish scale, in inches or meters with one documented convention
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

## Rendering Update Rules By Selection Type

### Model selection

- Can swap the entire base asset or procedural template
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
- If a given asset cannot scale safely, fall back to variant-specific meshes or procedural geometry

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

## Suggested Delivery Phases

### Phase 1: Fix visible experience

- Ensure the viewer always shows a visible empty state
- Ensure the controls and overlays stay above the floating footer
- Add explicit loading, fallback, and error states
- Restore a meaningful placeholder preview immediately after model selection

### Phase 2: Stable procedural 3D

- Build procedural table representations for each model family
- Support orbit, zoom, pan, and reset reliably
- Update appearance for key material and finish selections

### Phase 3: Asset manifest

- Add `data/viewer-models.json`
- Resolve selections to procedural, image, or glb representation
- Normalize camera framing and scaling rules per model

### Phase 4: Imported GLB support

- Add local `.glb` assets for priority models
- Implement targeted material overrides
- Keep procedural fallback for unsupported cases

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

Start with Phase 1 and Phase 2 before importing real 3D assets.

That means the next practical engineering target is:

1. Make the viewer visibly render an empty state and fallback state at all times.
2. Reserve a real bottom safe area above the floating footer for the viewer and its controls.
3. Replace the current blank experience with a stable procedural placeholder table in Three.js.
4. Add a manifest-driven path later for `.glb` imports instead of coupling asset logic directly to stage UI code.
