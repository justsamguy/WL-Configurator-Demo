Based on step 1 of the plan ("Define new data structure — Confirm which new JSON files/enhancements are needed, agree on field names and value formats"), here's a list of questions and items for you to review and confirm. These will help establish the exact structure, field names, and data formats before we start creating/updating the files:

## New Data Files

### `data/technicalSpecs.json`
-  this file Should contain global constants like tabletop thickness (fixed at 2" for all models)
- structure material densities:Object keyed by material name with density in g/in³
- organize leg specifications By leg style ID, with nested objects for dimensions, weights, tube specs etc.
- no weight multipliers need to show unless explicitly mentioned

### `data/shippingConfig.json`
- zones/regions should be defined by Current pricing.js (zones 1-8)
- Structure for shipping rates: by zone and method (Ground, Expedited, etc.)
- handle shipping accessorials (e.g., residential delivery, lift gate) with their current pricings. (In the technical summary, by listing those that were selected and just setting their value to "included")
-  transit time estimates Should be included here

## Enhanced Existing Files

### `data/addons.json`
- For each add-on, these technical specs fields are needed:? Power ratings (watts), dimensions, weight impact?
- Should electrical add-ons include cable lengths, color temps, CRI ratings?
- structure the `technicalSpecs` object per add-on in a way that is user-navigatable and can be updated in the future.
//TODO: Addon specs

### `data/materials.json`
- Density field: "density" with value in g/in³
- Hardness rating: "hardnessJanka" as number
- moisture content 

### `data/legs.json`
- Leg dimensions: "height", "width", "depth" in inches
- Setback distances: "setbackEnd", "setbackSide" in inches
- Wall thickness: "wallThickness" in "<inches> (<gauge>)"
- include weight per leg
- Mounting plate specs: separate object with size and thickness

### `data/finish.json`
- If 2K Poly is selected, it is a single coat
- If natural oil is selected, it is multiple coats based on the options below.


### `data/colors.json`
- Epoxy type: "epoxyType" as string?
- Layer information: "layers" as array or object describing pigment layers?
- Pigment composition: "pigments" as array of pigment names?
- Any color-specific technical notes (e.g., UV resistance)?

## General Questions
- Should all dimensions be in inches, weights in lbs, densities in g/cm³?
- How to handle units in field names (e.g., "densityGPerCm3" vs "density")?
- Any validation rules for the data (e.g., required fields, value ranges)?
- Should we include source references or notes for manufacturer specs?
- How to structure nested objects for complex specs (e.g., leg dimensions with multiple measurements)?

Please review these and let me know your preferences or any changes needed before we proceed to creating the files.