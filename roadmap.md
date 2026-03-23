# WL Configurator — Roadmap

## v1.1
- Add 3D model viewer
figure out resin color textures
ensure reference images are accurate and produce additional models
add U-channel models

- invent & add model handling for each add-on:
    - 


- replace/update all placeholder images added
- get a picture of caviar black
- make some sort of rainbow-colored epoxy/pigment image for custom color
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
