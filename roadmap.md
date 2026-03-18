# WL Configurator — Roadmap

## v1.1
- Add 3D model viewer
create & add models & textures
ensure reference images are accurate and produce additional models
- add logic that correctly places legs at their calculated setback
- invent & add model handling for each add-on
- wire finish sheen directly within app (no textures needed, just tabletop sheen)

- make presets and from-scratch builds visibly separate: 
make the 2 headers drop down automatically and have the tiles within but with no borders so the page feels continuous. make the headers larger and add arrows that auto rotate and have a hover effect so it's obvious they open and close. only allow one section to be open at a time - if one is opened, the other is closed. (but both can be closed at the same time). By default, customize a design is open and build from a layout is closed.
add a background gradient in the background that goes from the top of the page to the bottom, but in the space between the 2 sections, a transition is much more obvious. the gradient should be continuous for the whole background but much stronger right in that space. It also needs to scroll with the tiles. apply this gradient background *only* to the model page as well.
Add pill-styled labels into the top-right corners of the tiles - "Preset", "Layout", "[Model] Exclusive". Presets have a blue glow/shadow based off the app's light blue, layouts have a white glow/dark shadow, and exclusive layouts are at the top/front of the layouts list by default and have a gold glow/shadow. pill colors can reflect similar color choice but still readable - and make sure this is fully compatible with light and dark mode.


- replace/update all placeholder images added
- change all layout design images to be top-down (only presets get gallery-style photography) (use layout pictures to do this)
- Rename "addons" to "customizations"
- hide backend code?

## v1.2
- Mobile website (new branch)
 - review what triggers the mobile site (viewport width, browser agent, etc)
 - ensure all triggers are dynamic
 - hide 3D viewer on mobile or move it to a "preview" tab in the menu
 - make the footer from the desktop permanent and add a "back" button. keep the effect but keep it to the bottom of the screen instead of slightly above.
 - move the nav bar into a hamburger menu icon in the top left in a persistent header that shares space with the woodlab logo. make it look spatially balanced horizontally, and keep the logo size contained by the header size. move the light/dark/system to the bottom of the menu. the menu will come onto the screen from the left side and fill the whole screen, the hamburger icon animates and turns into an X icon in the top right of the menu while it fully opens. (animates and moves at the same time) tapping the X or swiping left or selecting a stage will close the menu (except models, where the menu only closes if the user picks "yes" in the dialog).

- Add the option to toggle tabletop and legs in the 3D viewer:
When un-selected, give the models 75% transparency instead of fully hiding them.
By default, make legs unchecked until a selection is made in the legs page (or a design preset has already pre-filled the selection)

## v2.0
- Rebuild app in React.js
