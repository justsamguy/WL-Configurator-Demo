# Technical Section Draft (v1)

This draft uses label/value rows intended for PDF export. Values in [brackets] are placeholders.

------------------------------------------------------------
Tabletop Dimensions: [L] in x [W] in x [T] in
------------------------------------------------------------
Overall Dimensions (with legs): [L] in x [W] in x [H] in
------------------------------------------------------------
Tabletop Thickness: 2 in +/- 0.25 in (cookie TBD, quoted separately)
------------------------------------------------------------
Edge Detail: [Rounded corners | Chamfered | Squoval | Other]
------------------------------------------------------------
Rounded Corners: 4 in radius (if selected)
------------------------------------------------------------
Chamfered Edges: 0.25 in at 45 degrees (if selected)
------------------------------------------------------------
Squoval: min tabletop width is 20% less than tabletop width
------------------------------------------------------------
Waterfall Edge: [count] sides, drop [H] in, calc = 2 x width x height
------------------------------------------------------------
Material: [Selected wood species]
------------------------------------------------------------
Material Density (lb/ft^3): use value from table below
------------------------------------------------------------
Material Hardness (Janka, lbf): use value from table below
------------------------------------------------------------
Finish Type: [2K Polyurethane | Osmo Natural Oil]
------------------------------------------------------------
Finish Sheen: [Satin | Matte | Gloss] (see reference below)
------------------------------------------------------------
Finish Coats: 2K poly is single coat; Osmo is multi-coat with Ceramic Pro Strong 1000 top coat
------------------------------------------------------------
Finish Tint: [Clear | Natural | Darken | Custom]
------------------------------------------------------------
Epoxy Layers: seal coat <0.25 in (matching colors) + river 2-2.5 in
------------------------------------------------------------
Pigment Composition: [color recipe; gradient dark to light]
------------------------------------------------------------
Leg Style: [Selected leg]
------------------------------------------------------------
Leg Material: HSS steel
------------------------------------------------------------
Leg Tube Wall Thickness: 14 gauge (0.083 in)
------------------------------------------------------------
Leg Width Logic: <=36 in table -> 26W; 36-42 in -> 28W; 43-48 in -> 32W; >=48 in -> (tabletop width - 10 in)
------------------------------------------------------------
Mounting Plate Length: tabletop width - 6 in
------------------------------------------------------------
Leg Setback (from end to leg): 12-14 in under 10 ft; 18-20 in at 10 ft+; coffee table 5-7 in
------------------------------------------------------------
Leg Setback (from side): calculated from tabletop width and leg size; include setback to leg and setback to plate
------------------------------------------------------------
Leg Exceptions: cube bases 0.25 in all sides; round design tripods 12-14 in all sides; cookie tripods 12+ in even; height TBD
------------------------------------------------------------
Leg Dimensions: use spec table below
------------------------------------------------------------
Leg Finish Color: [Matte Black | Satin Black | Oil Rubbed Bronze | Satin Bronze | Gunmetal Grey | Titanium Silver | Raw Metal]
------------------------------------------------------------
Add-ons: [list selected]
------------------------------------------------------------
Power Strip: 125V 15A; USB 5V 2.4A each; options AC 6 ports, AC+USB 3 AC 6 USB, AC+USB+USB-C 3 AC 3 USB 3 USB-C; rails 5 ft or 3 ft; cable length 12 ft default; color black
------------------------------------------------------------
Wireless Charging: up to 15W output, 20W input
------------------------------------------------------------
Ethernet/HDMI: Ethernet Cat5e; HDMI 2.0
------------------------------------------------------------
Lighting Options: see reference below
------------------------------------------------------------
Glass Top: 1/4 in thick; Glass Type: [blank]
------------------------------------------------------------
Estimated Total Weight: [tabletop + legs + hardware]
------------------------------------------------------------
Crate Dimensions: [from shipping calc]
------------------------------------------------------------
Crate Material: 7/16 in OSB walls/floor/top; frame 2x2/2x4/2x6 lumber
------------------------------------------------------------
Crate Hardware: T-25 screws 3/4-3 in
------------------------------------------------------------
Packaging: 1/4 in PE foam and 80Ga stretch wrap; foam lining 1 in EPS foam
------------------------------------------------------------
Empty Crate Weight: calculated from outside dims (OSB + lumber + 5% allowance)
------------------------------------------------------------
Crate Weight (loaded): [crate + contents]
------------------------------------------------------------
Shipping Method: [Standard Ground | Other]
------------------------------------------------------------
Estimated Transit Time: 5-10 business days (Standard Ground)
------------------------------------------------------------

## Material Density Reference (lb/ft^3)
| Species | Density range |
| --- | --- |
| Black Walnut | 35-38 |
| Spalted Maple | 30-40 |
| American Elm | 35-38 |
| Siberian Elm | 30-38 |
| Sycamore | 24-37 |
| Ash | 30-42 |
| Claro Walnut | 40+ |

## Material Hardness Reference (Janka, lbf)
| Species | Hardness range |
| --- | --- |
| Black Walnut | 950-1100 |
| Spalted Maple | 700-1100 |
| American Elm | 800-900 |
| Siberian Elm | 800-950 |
| Sycamore | 720-850 |
| Ash | 1200-1350 |
| Claro Walnut | 1000-1200 |

## Finish Sheen Reference
- 2K poly: Satin = 20 sheen, Matte = 10 sheen, Gloss = 30 sheen
- Osmo: Satin = 3043 Clear Satin, Matte = 3031 Clear Matte, Gloss = 3011 Clear Gloss
- Tint rules: 2K non-clear tints are custom. Osmo clear tint uses base coat 1101 Clear Satin. Osmo Natural replaces base coat with 3051 Raw Matte. Osmo Darken replaces base coat with 3166 Walnut.

## Pigment Composition Reference (dark to light)
- Multi Blue: Ocean, Maui, Caribbean gradient
- Multi-Grey: Caviar, Dolphin, Pearl gradient
- Copper Blend: Espresso, Coral, Pineapple gradient
- Multi-Green: Jungle, Emerald, Candy Apple gradient
- Dark Grey: Caviar + Dolphin
- Caviar Black: Caviar
- Solid Black: Liquid Pigment, Solid Black
- Custom: Custom

## Leg Spec Reference
- 26W x 28H: leg profile 26 x [longer tube dimension] x 27.75, plate 6 x 32 x 0.25
- 28W x 28H: leg profile 28 x [longer tube dimension] x 27.75, plate 6 x 34 x 0.25
- 28W x 32H: leg profile 32 x [longer tube dimension] x 27.75, plate 6 x 40 x 0.25

## Leg Color Reference
- Matte Black: Behr Metallic Matte Black
- Satin Black: Rustoleum Satin Black
- Oil Rubbed Bronze: Behr Oil Rubbed Bronze
- Satin Bronze: Rustoleum Satin Bronze
- Gunmetal Grey: Rustoleum Gunmetal Grey
- Titanium Silver: Rustoleum Titanium Silver
- Raw Metal: Rustoleum Clear

## Lighting Options Reference
Operating Temp: -10C to 45C
- White Tunable: 24V, 90+ CRI, 2700-6000K, non-addressable, 320 LED/m
- Color Basic: 24V, RGBW, non-addressable, 30-60 LED/m
- Color +FX: 12V, 90+ CRI, RGBW, FCOB, addressable (SPI control), app-compatible, 100-400 LED/m
- Custom: 5V/12V/24V, 91-94 CRI, CCT/RGB/RGBW, FCOB, addressable (SPI/DMX512/Art-Net/WS), custom effect software/TUYA compatible, up to 720 LED/m
