# Edge Profile 3D Preview Implementation Plan

## Goal

Add edge profile and corner shape customizations to the 3D preview without creating separate full 3D models for each variation.

The preview should treat the tabletop as procedural geometry driven by dimensions and option IDs. The table model remains the base design; edge and corner choices become geometry modifiers.

The current user-facing selections already exist as add-ons:

- `addon-chamfered-edges`
- `addon-squoval`
- `addon-rounded-corners`
- `addon-angled-corners`

The viewer implementation should consume those existing add-on selections instead of adding new app-level state. That matters because pricing, compatibility, summary, PDF export, presets, and add-on UI already depend on `state.selections.options.addon`.

## Recommended Data Shape

Use separate internal concepts for the tabletop plan shape and the edge profile:

```js
createTabletopGeometry({
  length,
  width,
  thickness,
  cornerShape: "standard" | "rounded" | "angled" | "squoval",
  edgeProfile: "square" | "chamfered"
});
```

Reasoning:

- `cornerShape` changes the 2D outline of the tabletop.
- `edgeProfile` changes the vertical/top perimeter detail.
- This avoids a growing set of separate models while keeping combinations understandable.
- It preserves the current product rule that some edge add-ons may be combined. Today, angled corners and chamfered edges are explicitly compatible in `js/main.js`; a single `edgeTreatment` field would lose that unless it was expanded into combinations.

Add a viewer-only resolver that maps current add-on IDs to geometry settings:

```js
function resolveTabletopGeometryOptions(addons = []) {
  return {
    cornerShape: addons.includes("addon-squoval")
      ? "squoval"
      : addons.includes("addon-rounded-corners")
        ? "rounded"
        : addons.includes("addon-angled-corners")
          ? "angled"
          : "standard",
    edgeProfile: addons.includes("addon-chamfered-edges") ? "chamfered" : "square"
  };
}
```

Why this is important: it keeps geometry concerns inside the viewer while preserving the existing app architecture. Stage modules continue to dispatch events, `js/main.js` continues to own state mutation, and the viewer remains a state consumer.

## Geometry Strategy

Build the tabletop in three steps:

1. Generate a 2D `THREE.Shape` outline from the selected `cornerShape`.
2. Extrude the shape into tabletop thickness with `THREE.ExtrudeGeometry`.
3. Apply the edge detail according to `edgeProfile`.

Example direction:

```js
const outline = createTabletopOutline({
  length,
  width,
  cornerShape
});

const geometry = new THREE.ExtrudeGeometry(outline, {
  depth: thickness,
  bevelEnabled: edgeProfile === "chamfered",
  bevelSize: edgeProfile === "chamfered" ? chamferSize : softEdgeSize,
  bevelThickness: edgeProfile === "chamfered" ? chamferDepth : softEdgeDepth,
  bevelSegments: edgeProfile === "chamfered" ? 1 : 2
});
```

Important caveat: `ExtrudeGeometry` bevels more than only the top edge by default. That is likely acceptable for a visual configurator preview, but if the preview must show a technically exact top-only chamfer, implement custom tabletop geometry later.

### Units, axes, and scaling

Use the current viewer convention:

- Width runs on X.
- Thickness/height runs on Y.
- Length runs on Z.
- Product dimensions are inches.
- Viewer geometry must convert inches with the manifest `unitsPerInch` value, currently `0.0254`.

Why this is important: the current viewer already scales imported GLB parts based on selected dimensions. Procedural geometry must not be generated at selected dimensions and then scaled a second time by the existing transform path. Pick one of these approaches:

1. Generate procedural tabletop geometry at the selected dimensions and skip normal tabletop X/Z scaling for that procedural tabletop mesh.
2. Generate procedural tabletop geometry at manifest source dimensions and let the existing scaling path resize it.

The first approach is easier to reason about for rounded corners, angled corners, and squoval because radii/cuts can stay true to selected product dimensions.

### Geometry constants

Keep all profile constants in one place, in inches, and clamp them before converting to viewer units:

```js
const TABLETOP_PROFILE_DEFAULTS_IN = Object.freeze({
  thickness: 2,
  chamferSize: 0.375,
  roundedCornerRadius: 4,
  angledCornerCut: 4,
  squovalEndTaper: 3,
  squovalCornerRadius: 10
});
```

Clamp each value against selected length/width. For example, a 4 in corner radius should not be allowed to exceed half the shortest dimension, and squoval taper should not consume enough width to distort small coffee table sizes.

Why this is important: selected dimensions span multiple table families, and constants that look good on a conference table can break a coffee table outline.

## Corner Shape Definitions

### Standard

Rectangular tabletop outline with square corners.

### Chamfered

This is not a corner shape. It is an edge profile:

- 45 degree bevel on the top edge.
- Runs around the tabletop perimeter.
- Should be represented as `edgeProfile: "chamfered"`.

### Rounded Corners

Tabletop outline remains rectangular except the four corners are rounded.

Implementation direction:

- Use a `THREE.Shape`.
- Add straight edges and quadratic or bezier curves at the corners.
- Keep radius as a fixed catalog value unless product rules require it to vary by size.
- Clamp the radius to the selected dimensions before shape generation.

### Angled Corners

Tabletop outline remains rectangular except the four corners are clipped.

Implementation direction:

- Use a polygon outline.
- Offset each corner by a fixed cut distance.
- Connect the offset points with diagonal segments.
- Keep the cut distance independent from chamfer size. Angled corners affect the plan outline; chamfer affects the top/perimeter edge.

### Squoval

Squoval changes the overall tabletop outline more substantially:

- Rounded end/corner feel.
- Slight width tapering on each end.
- Should be treated as a distinct `cornerShape: "squoval"` outline generator.

Implementation direction:

- Start from a symmetric outline centered on the tabletop origin.
- Use bezier curves for rounded ends.
- Apply a small taper so width narrows subtly near each end.
- Keep the taper amount and curve control points in constants so they can be tuned visually.
- Treat this as a named outline generator, not as "rounded corners plus taper" bolted onto the generic rounded-corner path.

Why this is important: squoval is visually its own product silhouette. Keeping it as a distinct generator makes future tuning safer and avoids making normal rounded corners depend on squoval-specific curve math.

## Suggested File Organization

Keep reusable tabletop geometry logic isolated from scene orchestration.

Possible structure:

```text
js/
  viewerTabletopGeometry.js
  viewerTabletopOutlines.js
```

If the current preview code is already organized differently, follow the existing local pattern instead of forcing this exact folder structure.

Potential responsibilities:

- `viewerTabletopOutlines.js`: create `THREE.Shape` instances for standard, rounded, angled, and squoval outlines.
- `viewerTabletopGeometry.js`: resolve add-on IDs, create `THREE.ExtrudeGeometry`, apply bevel settings, orient/center geometry, clamp constants, and expose one public `createTabletopGeometry(...)` function.
- `js/viewer.js`: call the geometry factory, replace or update the tabletop mesh, preserve materials, dispose replaced procedural geometries, and update viewer support notices.

Why this is important: the current `js/viewer.js` is already responsible for GLB loading, part transforms, material overrides, glass geometry, notices, camera framing, and state observation. Keeping outline/geometry math in small modules prevents the viewer module from becoming harder to maintain.

## State And Event Integration

Follow the repo architecture rules:

- Stage modules should not mutate global state directly.
- UI should dispatch an existing event such as `option-selected` if it fits.
- `js/main.js` should perform app-level state updates.
- The 3D preview should consume state and regenerate only the affected tabletop mesh.

Do not add these state fields for the current app:

```js
edgeTreatment: "standard" | "chamfered" | "roundedCorners" | "angledCorners" | "squoval"
cornerShape: "standard" | "rounded" | "angled" | "squoval",
edgeProfile: "square" | "chamfered"
```

Those concepts should be derived inside the viewer from `state.selections.options.addon`.

Why this is important: adding parallel state creates a synchronization problem. Every preset, reset, summary, pricing, PDF export, and compatibility path would need to keep add-ons and edge geometry state aligned.

If the product catalog is redesigned later to make edge treatment a standalone single-select option, then update the state model intentionally and also update `AGENTS.md`, Copilot instructions, and Cline rules if the shared architecture/workflow rules change.

## Viewer Integration Details

### Current viewer behavior to change

`js/viewer.js` currently treats edge profile add-ons as unsupported viewer details and shows the support notice "Edge profile changes are not modeled in the local viewer yet." Once this plan is implemented, remove that notice for supported edge profiles. Keep a conditional notice only for configurations still unsupported by procedural geometry.

### Mesh replacement strategy

The safest implementation is:

1. Load the existing render root as usual.
2. Find the `tabletop` part.
3. Capture or clone the tabletop material from the current tabletop mesh.
4. Replace only the tabletop geometry for supported non-live-edge, non-round, non-cookie configurations.
5. Preserve the current material override pipeline for wood species, finish sheen, and finish tint.
6. Recompute bounds and framing after geometry replacement.

Why this is important: the viewer already supports leg assets, material overrides, resin preview, glass top, camera preservation, and support notices. Replacing only the tabletop geometry keeps those systems intact.

### Original GLB safety

Do not dispose imported GLB geometry that may need to be restored when the user deselects the edge profile. Dispose only generated replacement geometries that are no longer used.

Why this is important: if the user toggles from chamfered back to standard in the same session, the viewer should restore the original tabletop cleanly without forcing a full GLB reload unless a reload is intentionally chosen.

### Render signatures and updates

Edge add-ons already cause `addonsChanged`, which calls `updateModel(...)`. If the render signature does not change, the viewer reuses the current asset and reapplies transforms. The procedural geometry update must run on both paths:

- initial `buildRenderRoot(...)`
- reused-render-root update paths where `applyConfiguredPartTransforms(...)` is called

Why this is important: otherwise edge changes may work only after a full reload, or they may fail when the viewer correctly reuses the current render root.

### Glass top and epoxy considerations

The current glass top implementation has special geometry for live edge and box geometry for standard rectangular tables. Rounded, angled, and squoval tabletops should eventually provide matching glass top outlines when `addon-glass-top` is selected.

For v1, acceptable choices are:

- update glass top geometry from the same tabletop outline, or
- leave glass rectangular but show a support notice that glass top shape is approximate for edge-profile selections.

The epoxy preview may also need follow-up clipping if procedural outlines expose resin geometry beyond the new tabletop perimeter.

Why this is important: once the tabletop silhouette changes, any overlay that remains rectangular can visibly hang past the edge and make the preview look broken.

### Materials and UVs

`THREE.ExtrudeGeometry` will render with the existing material, but UVs may stretch on top and side faces. For v1, this may be acceptable if the preview reads clearly. If texture quality matters, add a custom UV generator so top faces map in X/Z space and side faces map by perimeter distance and thickness.

Why this is important: the current viewer applies wood textures and finish/tint shaders. Bad UVs can make a correct shape look lower quality than the existing GLB.

## Rendering And UX Notes

- Reuse existing table legs/base meshes.
- Regenerate only the tabletop geometry when edge profile changes.
- Dispose old geometry after replacement to avoid memory leaks.
- Preserve the current material system so finishes continue to apply.
- Keep the preview responsive and keyboard-accessible through the existing UI controls.
- Add labels/descriptions in the option UI, but keep manufacturing-specific details in the summary/PDF Technical section.
- Keep unsupported-design notices accurate. Do not silently ignore a selected edge add-on if the viewer cannot model it for a specific design.
- Do not use `file://` for runtime verification; this project relies on ES modules, local fetches, and CDN assets.

## PDF And Technical Output

The summary/PDF Technical section already collects edge details from selected add-ons. When implementing the viewer, also check whether technical rows need to become more specific:

- Chamfered edges: add chamfer size/depth once confirmed.
- Rounded corners: existing row uses 4 in radius.
- Angled corners: replace `TBD` once the cut distance is confirmed.
- Squoval: add taper/radius specs once confirmed.

Why this is important: a 3D preview change can imply manufacturing detail. The repo rule requires new features/options to be reflected in the exported PDF Technical section when applicable.

## Verification Checklist

When implementing later:

- Confirm each treatment renders in the 3D preview.
- Confirm option changes update the preview without requiring a page refresh.
- Confirm finishes/materials still apply to the new tabletop geometry.
- Confirm selected dimensions still produce correct tabletop length, width, and thickness.
- Confirm geometry is not double-scaled after selected dimensions change.
- Confirm original tabletop geometry is restored or rebuilt correctly when edge add-ons are removed.
- Confirm rounded/angled/squoval outlines do not break at the smallest supported coffee table dimensions.
- Confirm glass top and epoxy overlays do not visibly overhang changed silhouettes, or show a clear support notice if they are approximate.
- Confirm edge-profile viewer support notices are removed or made conditional.
- Confirm summary and PDF Technical section include the selected edge treatment.
- Confirm no stage module directly calls `setState` or `setAppState`.
- Confirm keyboard navigation and focus states remain intact.
- Increment the app edit version in `js/main.js` after app code changes.

## Alternatives

### Procedural `THREE.Shape` plus `ExtrudeGeometry`

This is the recommended path.

Why it is good:

- No new dependencies.
- No asset explosion.
- Fits the static client-only app.
- Handles selected dimensions naturally.
- Keeps future edge/corner additions as code and data changes instead of model-export work.

Why it is not perfect:

- Default beveling affects more than only the top edge.
- UVs may need custom work for high-quality wood textures.
- Squoval tuning will require visual iteration.

### Tabletop-only GLB variants

Create separate tabletop GLBs for standard, chamfered, rounded, angled, and squoval, but keep legs/base separate.

Why it is good:

- Best visual fidelity.
- Artists can control exact bevels, normals, UVs, and silhouette.
- Less custom geometry math in the viewer.

Why it is not ideal:

- Still grows with model family, table size assumptions, design family, and future edge options.
- Requires a model export process for changes.
- Harder to keep dimensions truly procedural across wide size ranges.

This is a reasonable fallback for squoval only if procedural squoval cannot reach acceptable visual quality.

### Full GLB per edge/profile combination

Create complete table model variants for each edge treatment.

Why it is good:

- Simple runtime logic.
- Highest artist control per configuration.

Why it is poor for this app:

- It directly conflicts with the plan goal.
- Asset count grows quickly across models, designs, dimensions, legs, materials, and add-ons.
- Maintenance and load performance get worse over time.

Use this only for major silhouettes that cannot share a procedural or part-swapped approach.

### Directly deform existing GLB vertices

Modify imported tabletop mesh vertices after loading.

Why it is tempting:

- It could preserve the current GLB material setup and mesh object.
- It avoids creating a new mesh from scratch.

Why it is risky:

- It depends on the topology and naming of exported model files.
- Future model exports can break the algorithm.
- Cutting angled corners or creating a true squoval from an arbitrary mesh is much harder than generating a clean outline.

This is not recommended as the main approach.

### Overlay or cap meshes

Add extra meshes on top of the existing tabletop to visually suggest chamfers/corners.

Why it is good:

- Fast to prototype.
- Low impact on existing viewer transforms.

Why it is weak:

- It does not truly change the tabletop silhouette.
- It can create z-fighting and visible seams.
- Squoval and angled corners will still look rectangular from many camera angles.

This is only useful as a temporary visual placeholder.

### Shader or normal-map fake bevels

Use material tricks to make a square edge appear chamfered.

Why it is good:

- Very cheap at runtime.
- No geometry replacement.

Why it is insufficient:

- It cannot change the actual outline.
- It cannot represent rounded corners, angled corners, or squoval.
- It will be obvious from side and top-down views.

This is not enough for the stated goal.

### Runtime CSG or boolean cuts

Use constructive solid geometry operations to cut corners or bevel edges at runtime.

Why it is powerful:

- Can represent complex operations.
- Could support future geometry modifiers beyond edge profiles.

Why it is not a good fit right now:

- Likely requires a new dependency, which violates current repo constraints unless explicitly approved.
- More runtime complexity and performance risk.
- More failure modes in a static demo app.

Do not use this unless the user approves a dependency/rule change and procedural shape extrusion proves inadequate.

## Open Decisions

- Confirm current product rule: angled corners and chamfered edges are currently combinable; other edge profile combinations are not. If this changes, update compatibility logic first.
- What are the actual manufacturing dimensions for:
  - Chamfer size/depth.
  - Rounded corner radius.
  - Angled corner cut distance.
  - Squoval taper amount and curve radius.
- Does the preview need technically exact top-only chamfer geometry, or is `ExtrudeGeometry` beveling acceptable for the demo?
- Should glass top geometry follow rounded/angled/squoval outlines in v1, or is an approximate glass top with support notice acceptable for the first implementation?
- Should procedural edge profiles apply only to rectangular River/Encasement-style tables first, with round, cookie, live edge, and waterfall designs remaining unsupported or handled later?
