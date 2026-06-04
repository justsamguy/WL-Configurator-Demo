# Waterfall Edge Viewer Implementation Notes

Purpose: capture the implementation shape and review criteria for adding waterfall edge geometry to the Three.js viewer. This is not implemented yet.

## Desired outcome

A selected waterfall edge should render as a vertical continuation of the tabletop:

- The waterfall leg drops from the tabletop end to the floor.
- The top surface visually continues down the outward waterfall face.
- Wood and epoxy both continue, because the current viewer uses separate wood and epoxy tabletop parts.
- The waterfall is visible from both sides, with real geometry and correct normals.
- Waterfall width follows the selected table width.
- Waterfall height follows the selected table height/drop.
- Waterfall depth along the table length stays fixed at 2 inches, matching tabletop thickness.
- The tabletop-to-waterfall corner should read as seamless, without visible gaps, z-fighting, or flickering faces.

## Current viewer context

The viewer coordinate assumptions are:

- X = table width.
- Y = vertical height.
- Z = table length.

The current viewer loads tabletop geometry as separate parts from `data/viewer-models.json`:

- `tabletop`: the wood/table body GLB.
- `tabletop-epoxy`: a separate epoxy overlay GLB.

This matters because a wood-only waterfall panel would be visibly wrong on river/epoxy tables. The waterfall needs to be a composite continuation of both layers.

Relevant code areas:

- `js/viewer.js`
  - `WATERFALL_VIEWER_ADDON_IDS`: waterfall add-ons are recognized.
  - `getCurrentViewerSelectionContext()`: includes `waterfallCount`.
  - `buildLegRenderableParts()`: single waterfall currently removes the leg nearest the default view; two waterfalls suppress standard legs.
  - `computeTabletopTransform()`: scales tabletop width/length from selected dimensions.
  - `computeEpoxyTransform()`: scales and positions epoxy after the tabletop transform.
  - `applySelectedTabletopMaterial()`, `applySelectedTabletopSheen()`, `applySelectedTabletopTint()`: apply wood material/finish overrides to `tabletop`.
  - `applySelectedResinPreview()`: applies resin color/gradient material only to `tabletop-epoxy`.
  - `applyConfiguredPartTransforms()`: best place to update or position waterfall geometry because it has post-scale tabletop and epoxy metrics.
  - `collectViewerSelectionNotices()`: currently says waterfall geometry is not fully modeled; update this after implementation.
- `js/stages/summary.js`
  - Technical specs already include waterfall count/drop and `2 x width x height` calculation.
- `js/pricing.js`
  - `getWaterfallEdgeCount()` counts single/second waterfall add-ons.
  - Leg pricing already reflects one waterfall replacing half the leg assembly and two waterfalls replacing legs.

## Recommended implementation shape

Prefer procedural viewer geometry over new GLB assets for the first implementation.

Reasons:

- No new dependency or build step is needed.
- It can scale directly from selected dimensions.
- It avoids maintaining separate single/double waterfall model assets.
- It allows the 2 inch Z depth to stay fixed while width and height scale.
- It can reuse the already-configured wood and resin materials from the current render root.

Add a persistent waterfall group to the render root, similar in spirit to `createGlassTopPart()`, then update it from `applyConfiguredPartTransforms()` after both tabletop and epoxy transforms have run.

Suggested structure:

- `createWaterfallParts()` or equivalent creates a root group, initially hidden.
- `computeWaterfallTransform(renderRoot, unitsPerInch, tabletopMetrics, epoxyMetrics)` updates/rebuilds visible waterfall meshes.
- For single waterfall, render one panel at the same end currently replacing the standard leg.
- For double waterfall, render panels at both Z ends.

The waterfall should be composed from separate meshes/materials:

- Wood body or wood side bands using cloned material from the transformed `tabletop`.
- Resin insert using cloned material from the transformed `tabletop-epoxy`.
- Optional subtle corner/skin mesh if needed to hide the original GLB end face and make the texture read as continuous.

## Geometry details

The fixed waterfall thickness/depth is:

```text
waterfallDepth = 2 * unitsPerInch
```

The selected dimensions should drive:

- `waterfallWidth = tabletopMetrics.max.x - tabletopMetrics.min.x`
- `waterfallHeight = tabletopMetrics.max.y - floorY`
- `waterfallDepth = fixed 2 inches in Z`

Use the transformed tabletop bounds, not raw selected dimension values, so the result stays aligned with the existing GLB and any current surface inset behavior.

Placement notes:

- Single waterfall should use the same end that `buildLegRenderableParts()` treats as replaced today, so leg removal and waterfall placement agree.
- Double waterfall should render both `+Z` and `-Z` ends and continue to suppress standard legs.
- The waterfall should sit flush to the tabletop end visually.
- Avoid coplanar overlap with the original tabletop end face. Either omit the waterfall's hidden top/end coplanar faces, inset by a tiny amount, or add a wrap/skin that intentionally covers the corner.

Do not rely only on `material.side = THREE.DoubleSide` to make it visible from both sides. Build real front/back/side faces with correct normals so lighting and shadows behave predictably.

## Wood and epoxy continuity

The plan must account for the separate epoxy layer.

Minimum acceptable result:

- The wood waterfall spans the full physical panel.
- A resin waterfall insert aligns with the transformed epoxy strip/channel in X.
- The resin insert uses the same configured resin preview material as `tabletop-epoxy`.
- The wood material uses the same configured material/finish/tint as `tabletop`.

Better result:

- Split the waterfall face into wood/resin/wood regions using `epoxyMetrics`:
  - left wood band: `tabletop.min.x` to `epoxy.min.x`
  - resin band: `epoxy.min.x` to `epoxy.max.x`
  - right wood band: `epoxy.max.x` to `tabletop.max.x`
- This makes the vertical face read like the top cross-section instead of painting resin over the whole waterfall.

Best visual result:

- Add custom UVs or object-space texture mapping so the wood/resin texture continues over the corner:
  - top surface samples by X/Z.
  - waterfall outside face samples by X/Y with an offset that begins at the tabletop end.
- A thin wrap/skin over the last 2 inches of tabletop plus the vertical face may be needed to hide the existing GLB end-face UVs and avoid a visible texture break.

Why this matters: if the waterfall only clones the current material onto a box, dimensions may be correct but the grain/resin will not convincingly flow from the top surface down the outside face.

## Material handling

Build waterfall materials after existing material overrides have been applied:

1. Load parts.
2. Apply tabletop material/species override.
3. Apply tabletop sheen/tint.
4. Apply resin preview material/color/gradient.
5. Create/update waterfall meshes using clones of the final tabletop and epoxy materials.
6. Re-run active resin material tracking if the resin waterfall uses transparent resin preview materials.

Important: `activeResinPreviewMaterials` is used for view-dependent resin transmission. If the waterfall resin mesh has a resin preview material, include it in the active material set so opacity/transmission stays consistent while orbiting.

## Review checklist

Implementation review should verify:

- Single waterfall renders one panel and removes/replaces only the intended end leg.
- Double waterfall renders two panels and standard legs are hidden/replaced.
- The waterfall remains 2 inches deep along Z at all selected table lengths.
- Width tracks selected table width.
- Drop tracks selected table height.
- The waterfall is visible and lit correctly from front, back, and side views.
- No visible gap appears at the tabletop-to-waterfall corner.
- No z-fighting/flickering appears at the corner or epoxy overlay.
- Epoxy/resin continues down the waterfall face when a resin table is selected.
- Resin color/gradient and view-dependent transparency still work after adding waterfall resin meshes.
- Finish sheen/tint/material overrides apply to waterfall wood.
- Viewer framing includes the added waterfall geometry.
- Viewer limitation notice for waterfall is removed or narrowed only after the geometry is actually represented.
- PDF technical specs remain accurate; current summary specs already include waterfall drop and `2 x width x height`, so only adjust if the modeled spec changes.

## Likely implementation order

1. Add constants for waterfall add-on ids, depth in inches, and any tiny seam/clearance values.
2. Add helpers to clone the current tabletop and epoxy materials from existing meshes.
3. Add procedural rectangular panel geometry with explicit UVs and normals.
4. Add a hidden waterfall root group to the render root during build.
5. Update `applyConfiguredPartTransforms()` so tabletop and epoxy metrics are captured before computing waterfall geometry.
6. Generate one or two waterfall groups based on `getWaterfallEdgeCount(state)`.
7. Align resin waterfall insert from transformed `epoxyMetrics`.
8. Update resin active-material tracking to include waterfall resin materials.
9. Remove or narrow the current waterfall viewer notice.
10. Manually verify common selections: no waterfall, single waterfall, double waterfall, material changes, resin color changes, dimension changes, and long-table center leg behavior.

## Important non-goals for first pass

- Do not add new dependencies.
- Do not introduce server code or external business-data APIs.
- Do not replace the whole tabletop rendering pipeline unless the procedural composite approach cannot satisfy the seam/texture requirement.
- Do not change pricing semantics unless the physical waterfall assumptions change.

