# Leg Finish Material Calibration

This file records the initial viewer material targets for the leg finish catalog in `data/leg-finish.json`.

The current hourglass leg GLB is the baseline render reference. The option-card sample images in `assets/images/Leg styles/Leg Colors/` are used for calibration only, not as texture maps.

## Calibration Rules

- Match hue family first.
- Match relative brightness second.
- Match perceived gloss third.
- Do not copy sample-image hotspots, edge reflections, or falloff directly into the viewer material values.
- Preserve visible separation between adjacent finish options under the current Three.js studio lighting.

## Finish Notes

- Matte Black: Anchor finish for the darkest option. It should stay flatter than every other finish in the viewer.
- Satin Black: Same near-black family as Matte Black, but clearly more reflective under key and rim lights.
- Oil Rubbed Bronze: Dark warm bronze that still reads deeper and less polished than Satin Bronze.
- Satin Bronze: Brighter and warmer than Oil Rubbed Bronze, with a more premium reflective read.
- Gunmetal Grey: Cool mid-dark metal that sits between the black finishes and the brighter steel finishes.
- Titanium Silver: Brightest cataloged finish. It should read polished but not mirror-like.
- Raw Metal: Industrial steel finish that should read cooler and less refined than Titanium Silver.
- Custom: Neutral fallback only. It should not imply that brushed stainless is the final real-world finish.

## Sample Images To Watch

- `Titanium Silver.webp`: Strong highlight bias; a flatter swatch would improve future calibration.
- `Raw Metal.webp`: Specular contrast likely overstates polish relative to the intended raw-metal look.
- `Brushed Stainless.webp`: Currently functions as a placeholder reference for `Custom`, not a final finish target.
- `Oil Rubbed Bronze.webp`: Warm environment reflections may push the image brighter than the desired viewer material.

## Verification Checklist

- Every leg finish entry includes `viewerMaterial`, `calibrationNote`, and `calibrationImageAssessment`.
- The two black finishes remain distinguishable in side-by-side comparison.
- Gunmetal Grey, Raw Metal, and Titanium Silver do not collapse into the same neutral metal appearance.
- Bright finishes remain readable against both light and dark viewer backgrounds.
