# Viewer Model Contract

This document defines the first-pass contract between exported GLB assets and the browser viewer. The goal is to make the viewer interpret model files intentionally instead of guessing from arbitrary mesh topology.

## Current Runtime Shape

- `data/viewer-models.json` remains the runtime manifest.
- `data/viewer-model-inventory.json` tracks active, runtime-code, and legacy-candidate assets.
- `scripts/validate-viewer-models.mjs` validates manifest and inventory consistency.
- Rounded and angled edge profiles use a material mask preview. Chamfered edges use an exterior tabletop bevel preview. Squoval is tracked as a future design/model path.
- Contract tabletop implementation files live in `assets/models/contract/`.
- Original tabletop GLBs are copied to `assets/models/reference-originals/` for comparison.

## Current Asset Audit Notes

- Original `Walnut tabletop.glb` has one node/mesh named `Tabletop`, one material, one embedded image, and one texture.
- Original `live-edge-walnut-river-tabletop.glb` has one node/mesh named `Tabletop`, one material, and no embedded images/textures.
- Original `epoxy-edited-multi-grey.glb` has one node/mesh named `Tabletop`, one material, one embedded image, and one texture.
- The current contract GLBs preserve that geometry/material content but normalize Blender node transforms and rename the mesh/object/materials to stable contract names.
- Because the tabletop and epoxy assets are finished single-mesh visual pieces, the viewer cannot safely infer separate slab pieces, island pieces, resin fill, or editable boundary loops from the GLBs alone.
- The leg assets are more naturally separated into named bars/plates and are less risky for the current scaling/placement model.

## Required Tabletop Contract

Runtime tabletop assets should resolve to these logical parts:

- `tabletop`: wood tabletop source.
- `tabletop-epoxy`: epoxy preview/fill source.
- `tabletop-glass`: generated viewer part when the glass add-on is selected.
- `tabletop-waterfall`: generated viewer part when waterfall add-ons are selected.

The contract assumes this coordinate basis:

- X axis: tabletop width.
- Y axis: height/thickness.
- Z axis: tabletop length.
- Origin: centered horizontally, bottom aligned after viewer import normalization.
- Units: source dimensions are recorded in inches and converted by `dimensionRules.unitsPerInch`.

## Texture And Layout Rules

- Preserve top-surface UVs for wood.
- Preserve top-surface UVs and interior layout for epoxy.
- Do not remap the tabletop top face as part of edge shaping.
- Do not use runtime geometry replacement for the whole tabletop unless the exported source asset is designed for it.
- Future edge operations may affect only the outer tabletop boundary.

## Edge Editing Rules

The current contract uses material-space clipping for rounded and angled previews. Chamfered edges may add exterior bevel preview geometry to the wood tabletop, but must not replace the tabletop source meshes or edit the epoxy river's interior boundaries.

TODO: Move Squoval out of runtime edge modifiers and into a dedicated design/model path with its own tabletop source asset or exported footprint metadata. Squoval changes the 2D tabletop silhouette, so it should not be implemented as a small edge treatment on the standard slab.

Before enabling true cut-face/side-wall geometry, the source assets need one of these supported paths:

- Clean separated tabletop regions with known rectangular source bounds and stable UVs.
- A known outer-boundary loop or exported metadata that identifies the editable perimeter.
- Purpose-built edge/side-band geometry that can follow the selected outline without changing the top surface.

The browser should act as a geometry finisher, not as the table designer. The river layout, islands, wood grain basis, material assignment, and source dimensions should come from the model/export data.

## Export Expectations

For future GLB exports:

- Use stable node/material names.
- Keep wood, epoxy, glass, and base/legs logically separate.
- Apply transforms before export unless a viewer rule explicitly needs an unapplied transform.
- Keep tabletop source bounds documented in the manifest.
- Re-run `node scripts/validate-viewer-models.mjs` before committing asset or manifest changes.
