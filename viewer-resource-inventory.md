# Viewer Resource Inventory

## Purpose

This file lists the resources expected for a real built-out 3D viewer, based on the app's current option set and the agreed viewer direction:

- inches as the unit convention
- `.glb` as the only runtime model format
- whole-model swaps only for major silhouette changes
- part swaps for component changes
- material swaps for appearance changes
- low-visual-impact options may remain summary-only

This is an implementation inventory, not a commitment that every item must be modeled immediately.

## Core Runtime Resources

These are required regardless of which individual table options are modeled first.

### Viewer code and data

- `js/viewer.js` runtime viewer module with `GLTFLoader`
- `data/viewer-models.json` manifest for model/design mapping
- `data/viewer-materials.json` manifest for material slot mappings and texture sets
- `data/viewer-dimensions.json` or equivalent dimension rules inside the main viewer manifest
- viewer status strings and loading/error UI assets

### Scene-level resources

- one persistent Three.js scene setup
- one camera/framing configuration set per supported base model
- one ground plane or contact-shadow resource
- one viewer empty state
- one viewer loading state
- one viewer error state

## Base Model Families

These are the top-level furniture families currently exposed in the app and should be treated as the first base `.glb` groups.

### Required base families

- `mdl-coffee` -> Coffee Table
- `mdl-dining` -> Dining Table
- `mdl-conference` -> Conference Table

### Expected base `.glb` resources

- at least one base `.glb` for coffee
- at least one base `.glb` for dining
- at least one base `.glb` for conference

## Design-Level Model Resources

These are the current design choices that affect silhouette, top layout, or river composition strongly enough to matter in the viewer.

### Current design ids

- `des-river`
- `des-slab`
- `des-encasement`
- `des-encased-slab`
- `des-keystone`
- `des-round`
- `des-cookie`
- `des-custom`

### Recommended viewer treatment by design

#### Base-model or major top-layout variants

- `des-river`
- `des-slab`
- `des-encasement`
- `des-encased-slab`
- `des-round`
- `des-cookie`
- `des-keystone`

These likely need either:

- a distinct base `.glb`, or
- a clearly distinct tabletop/top-layout variant inside a model family

#### Special-case / limited-fidelity treatment

- `des-custom`

Recommended treatment:

- use a designated custom-design `.glb` placeholder if available, or
- use the nearest supported base model and clearly indicate that the final design is custom

## Dimension Resources

Dimensions are a major viewer requirement because the current allowed range is large.

### Dimension rule resources

- per-model default camera framing values
- per-model safe scaling ranges
- size-bucket rules where a single `.glb` should not stretch too far
- leg/base reposition rules for width and length changes
- round-top handling rules for equal-axis scaling

### Current rectangular dimension presets

- `dim-preset-01` -> 72x36
- `dim-preset-02` -> 84x42
- `dim-preset-03` -> 96x42
- `dim-preset-04` -> 108x48
- `dim-preset-05` -> 120x48
- `dim-preset-09` -> 144x48
- `dim-preset-06` -> 48x24
- `dim-preset-07` -> 52x26
- `dim-preset-08` -> 60x30

### Current round dimension presets

#### Coffee

- `dim-round-coffee-30`
- `dim-round-coffee-36`
- `dim-round-coffee-42`
- `dim-round-coffee-48`
- `dim-round-coffee-54`
- `dim-round-coffee-60`

#### Dining

- `dim-round-dining-42`
- `dim-round-dining-48`
- `dim-round-dining-54`
- `dim-round-dining-60`

#### Conference

- `dim-round-conference-54`
- `dim-round-conference-60`
- `dim-round-conference-66`
- `dim-round-conference-72`

### Dimension implementation resources expected

- one rectangular scaling/reposition rule set per supported base family
- one round-top scaling rule set per supported round family
- size-bucket `.glb` variants for any family that cannot scale cleanly across the full range

## Tabletop Geometry Resources

These are the runtime-editable mesh regions expected from exported models.

### Required tabletop-related mesh groups

- tabletop slab/top surface
- river/resin region where applicable
- live-edge or perimeter profile where applicable
- waterfall side panels where applicable

### Optional but recommended separations

- left slab half / right slab half for river designs
- edge-profile mesh if edge styles need visual switching later
- underside support structure if it changes independently

## Leg and Base Resources

These are the current leg/base options exposed in the app.

### Current leg ids

- `leg-sample-02` -> Cube
- `leg-sample-04` -> Squared
- `leg-sample-05` -> Tapered
- `leg-sample-06` -> X Style
- `leg-sample-03` -> Hourglass
- `leg-sample-08` -> Tripod
- `leg-sample-07` -> Custom
- `leg-signature` -> Signature
- `leg-none` -> None

Hidden / currently not expected in viewer unless restored:

- `leg-sample-01` -> C Style

### Expected leg/base viewer resources

- one `.glb` or swappable mesh/group for each active leg/base family
- leg placement rules for coffee, dining, and conference footprints
- one explicit no-leg handling rule for `leg-none`

### Tube size resources

Current tube ids:

- `tube-1x0.5`
- `tube-1x1`
- `tube-1x3`
- `tube-2x4`

Expected viewer resource treatment:

- geometry variants if tube profile changes silhouette meaningfully
- otherwise, profile metadata plus compatible leg/base mappings

## Material Resources

These are appearance-only or mostly appearance-driven options and should be handled through material swaps wherever possible.

### Wood species material sets

Current material ids:

- `mat-01` -> Black Walnut
- `mat-02` -> Spalted Maple
- `mat-03` -> American Elm
- `mat-04` -> Siberian Elm
- `mat-05` -> Sycamore
- `mat-06` -> Ash
- `mat-07` -> Claro Walnut
- `mat-08` -> Custom Wood
- `mat-09` -> Cookie Exclusive Wood

Expected resources per supported wood material:

- base color / albedo texture or color setup
- roughness definition
- normal map if used
- optional ambient occlusion map if authored
- mapping rules for tabletop wood slot

Special handling:

- `mat-08` custom wood should use a fallback/custom placeholder material unless a real texture set is supplied
- `mat-09` only needs support where `des-cookie` is allowed

### Resin / color material sets

Current color ids:

- `color-01` -> Custom
- `color-02` -> Multi-Blue
- `color-03` -> Multi-Grey
- `color-04` -> Copper Blend
- `color-05` -> Multi-Green
- `color-06` -> Dark Grey
- `color-07` -> Caviar Black
- `color-08` -> Solid Black

Expected resources per supported resin material:

- base color or color-gradient definition
- roughness / gloss tuning
- translucency-like approximation rules if used in the viewer
- glitter/flake/highlight treatment only if lightweight and consistent

Special handling:

- `color-01` custom should use a fallback custom-color material or user-note state

### Finish resources

#### Coatings

- `fin-coat-02` -> 2K Poly
- `fin-coat-01` -> Natural Oil

Expected viewer treatment:

- roughness/specular response presets
- optional subtle clearcoat differences if supported

#### Sheens

- `fin-sheen-01` -> Matte
- `fin-sheen-02` -> Satin
- `fin-sheen-03` -> Gloss

Expected viewer treatment:

- per-sheen roughness/gloss adjustment set

#### Tints

- `fin-tint-01` -> Clear
- `fin-tint-02` -> Natural
- `fin-tint-03` -> Darken
- `fin-tint-04` -> Custom

Expected viewer treatment:

- tone adjustment rules layered onto wood materials
- custom tint placeholder state for `fin-tint-04` if no exact value is supplied

### Leg finish material sets

Current leg finish ids:

- `leg-finish-01` -> Matte Black
- `leg-finish-02` -> Satin Black
- `leg-finish-03` -> Oil Rubbed Bronze
- `leg-finish-04` -> Satin Bronze
- `leg-finish-05` -> Gunmetal Grey
- `leg-finish-06` -> Titanium Silver
- `leg-finish-07` -> Raw Metal
- `leg-finish-08` -> Custom

Expected resources per supported leg finish:

- metal base color
- roughness / reflectivity preset
- optional subtle texture/noise map

Special handling:

- `leg-finish-08` custom should use a default custom-metal placeholder material unless a final finish is specified

## Add-on Resources

Not every add-on needs 3D treatment. These should be split into visible geometry, optional overlays, and summary-only items.

### Add-ons likely worth visible 3D support

- `addon-live-edge`
- `addon-waterfall-single`
- `addon-waterfall-second`
- `addon-waterfall-art`
- `addon-lower-shelf`
- `addon-glass-top`
- `addon-embedded-logo`
- `addon-custom-river`
- `addon-chamfered-edges`
- `addon-squoval`
- `addon-rounded-corners`
- `addon-angled-corners`

Expected resources:

- geometry variants or visibility toggles
- edge-profile variants where applicable
- decal/inlay placeholder approach for embedded logos if modeled

### Tech add-ons that may need simplified 3D treatment

- `addon-power-ac`
- `addon-power-ac-usb`
- `addon-power-ac-usb-usbc`
- `addon-wireless-charging`
- `addon-ethernet`
- `addon-hdmi`
- `addon-lighting-white`
- `addon-lighting-color-basic`
- `addon-lighting-color-fx`
- `addon-lighting-custom`
- `addon-custom-tech`

Recommended viewer treatment:

- optional simplified ports/modules if easy to represent
- lighting emissive material states for lighting options
- summary-only is acceptable for most connectivity features in the first implementation

### Add-ons likely summary-only unless prioritized

- `addon-03` expedited production
- `addon-installation`

## Visibility and State Resources

These are app-facing viewer resources needed to keep the experience clear.

### Viewer states

- empty-state copy
- loading-state copy
- error-state copy
- unsupported-option copy
- custom-option placeholder copy

### Optional viewer badges or labels

- custom design badge
- custom material badge
- quoted separately badge
- unsupported in 3D badge

## Per-Stage Resource Summary

### Models stage

- 3 base family `.glb` assets minimum
- camera presets
- empty/loading/error viewer states

### Designs stage

- design-level base `.glb` variants or top-layout variants for 8 current design ids
- mapping rules by compatible model family

### Tabletop / Materials stage

- 9 wood material sets
- 8 resin color sets
- mesh slot standards for tabletop and river areas

### Finish stage

- 2 coating response presets
- 3 sheen response presets
- 4 tint adjustment presets

### Dimensions stage

- rectangular and round dimension rule sets
- size-bucket logic where needed
- leg/base reposition rules

### Legs stage

- leg/base mesh swaps for active leg options
- 4 tube profile handling rules
- 8 leg-finish material sets

### Add-ons stage

- geometry toggles or variants for visually important add-ons
- summary-only handling for non-visual or low-value options

## Minimum Viable Viewer Resource Set

If the goal is to get the first real 3D implementation working fast, the minimum practical starting set is:

- 1 known-good `.glb` for each of the 3 base model families
- 1 viewer manifest
- 1 wood material set
- 1 resin color set
- 1 metal leg finish set
- 1 round-top capable model or one explicit round variant
- loading/error/empty viewer states
- dimension rules for one rectangular family and one round family

## Likely Expansion Order

Recommended order to build out the full resource library:

1. Base families: coffee, dining, conference
2. Major design variants: river, slab, round, encasement
3. Core material sets: walnut, maple, elm, key resin colors
4. Core leg/base families: squared, tapered, hourglass, X, tripod
5. Dimension handling for rectangular and round families
6. High-value add-ons: waterfall, shelf, glass top, live edge
7. Remaining finish and custom-option placeholder states
