# Plan: Build Technical Section with Hybrid Data Strategy

**Summary:** Create a detailed Technical specification page for exported PDFs with a clean left-label/right-value layout. The section will pull from existing data files for product basics, but will require new data files and JSON enhancements to support material density, leg geometry, add-on electrical specs, shipping details, and crate dimensions—all critical for accurate weight, size, and shipping-time calculations.

## Initial Data Collection & Structure

### Phase 1: Data Audit & New File Strategy

1. Identify what new data files/enhancements are required:
   - New file: `data/technicalSpecs.json` — consolidate material densities, leg dimensions/weight, tube wall thickness, tabletop thickness, weight multipliers
   - New file: `data/shippingConfig.json` — move hardcoded weight rules, shipping zones, rates, and accessorial pricing from `js/pricing.js` to data-driven config
   - Enhance `data/addons.json` — add `technicalSpecs` object per add-on (power ratings, dimensions, crate impact)
   - Enhance `data/materials.json` — add density (g/cm³), hardness rating, finish compatibility notes
   - Enhance `data/legs.json` — add leg height, width, depth, setback distance, wall thickness
   - Enhance `data/finish.json` — add coating thickness (microns), cure time, application notes
   - Enhance `data/colors.json` — add epoxy type, layer information, pigment composition notes

2. Collect specs from you (or design team/manufacturer docs) for:
   - Material densities & hardness ratings
   - Leg geometry & setback distances per leg style
   - Tube wall thicknesses (gauge)
   - Tabletop thickness (fixed at 2" for all models)
   - Add-on electrical specs (watts, outlets, cable lengths, color temps, CRI)
   - Crate dimensions formula (dynamic based on table size), wall/floor/top/frame specs, weights (formulated based on material weights)
   - Shipping time estimates by region/method (show "5–10 business days" for all Standard Ground)

## Technical Section Content Layout

**Structure (left-label / right-value with lines above/below each row):**

```
─────────────────────────────────────────
Tabletop Dimensions         72" L × 36" W × 2" thick
Overall Dimensions (with legs)  72" Long × 36" Wide × 30" Tall
─────────────────────────────────────────
Material                    Black Walnut
Material Density            0.68 g/cm³
Hardness (Janka)           1010
Wood Finish Coating        2K Polyurethane
Finish Sheen               Satin
Finish Tint                Clear
Pigment Composition        Color1, Color2, Color3...
Color Layout               [description of pigments and placement in river design]
─────────────────────────────────────────
Leg Style                   X
Leg Material                HSS Steel
Leg Tube Size              2×4"
Leg Tube Wall Thickness    0.065"
Leg Setback (from end)    12"
Leg Setback (from side)    4"
Leg Finish                 Matte Black
Legs (qty)                 2
Single-Leg Dimensions (overall)        28" H × 28" W × 8" D
Single-Leg Weight (overall)             40 lbs
Single-Leg Dimensions (minus plate)        27.25" H × 28" W × 4" D
Mounting Plate Size         30" L × 8" W × 0.25" T
─────────────────────────────────────────
Estimated Total Weight     285 lbs
  (Tabletop + Legs + Hardware)
─────────────────────────────────────────
[SELECTED ADD-ONS, each with unique specs]
Live Edge Details          2" edge width, American cherry
Waterfall Edge (1x)        Single waterfall side, 12" drop
─────────────────────────────────────────
[SHIPPING (if applicable)]
Shipping Method            Standard Ground
Crate Dimensions           79" L × 43" W × 37" H
Crate Material (walls)     5/8" OSB plywood + 2×2/2x4/2x6 lumber frame
Crate Weight (empty)       85 lbs
Crate Weight (loaded)      370 lbs
Estimated Transit Time     5–10 business days
Delivery Region            Zone 3 (Midwest)
─────────────────────────────────────────
```

## Steps

1. **Define new data structure** — Confirm which new JSON files/enhancements are needed, agree on field names and value formats
2. **Collect manufacturer specs** — Gather material densities, leg geometry, tube specs, add-on electrical ratings, crate/shipping details from your data/design team
3. **Create/update data files** — Populate `data/technicalSpecs.json`, `data/shippingConfig.json`, and enhance existing data files with new fields
4. **Refactor pricing.js weight logic** — Move hardcoded weight rules to `data/technicalSpecs.json` and update `js/pricing.js` to reference the config
5. **Build Technical page renderer** — Add new function in `js/export.js` to format Technical section with left/right label-value pairs, line separators, add-on subsections, and conditional shipping block
6. **Test with multiple configurations** — Verify weight, crate, and shipping data display correctly for different table sizes, leg styles, and add-on combinations
