# WL Configurator — Roadmap

## v1.1
produce additional models:
U-channels
Chair for reference
1x1" cube base

- invent some sort of volumetric resin texture handling?
- implement waterfall edge in 3d viewer
- replace/update all placeholder images added
- make some sort of rainbow-colored epoxy/pigment image for custom color

## v1.2
- Mobile website (new branch)
 - review what triggers the mobile site (viewport width, browser agent, etc)
 - ensure all triggers are dynamic
 - hide 3D viewer on mobile or move it to a "preview" tab in the menu
 - make the footer from the desktop permanent and add a "back" button. keep the effect but keep it to the bottom of the screen instead of slightly above.
 - move the nav bar into a hamburger menu icon in the top left in a persistent header that shares space with the woodlab logo. make it look spatially balanced horizontally, and keep the logo size contained by the header size. move the light/dark/system to the bottom of the menu. the menu will come onto the screen from the left side and fill the whole screen, the hamburger icon animates and turns into an X icon in the top right of the menu while it fully opens. (animates and moves at the same time) tapping the X or swiping left or selecting a stage will close the menu (except models, where the menu only closes if the user picks "yes" in the dialog).

- Add a way to display edge customizations in the viewer (edge_profile_3d_preview_plan.md)
- Add the option to toggle tabletop legs anbd chairs in the 3D viewer (separate toglles for each):
When un-selected, give the legs 80% transparency instead of fully hiding them. Make chairs fully hidden.
By default, make legs unchecked until a selection is made in the legs page (or a design preset has already pre-filled the selection)
- Add desk model
    - Add Sit-Stand Base option
    - Add Monitor Arms Addon
## v2.0
- Rebuild app in React.js to allow for updates to be pushed to branches and immediately reflect in-browser.

## v2.x
 - Ability to upload and move logos within the viewer
 - Screensaver (prompt after 5min inactivity w/ 15sec countdown), then start a full-view slideshow of slowly panned imagery that goes away when the mouse is moved. Images are to be zoomed in to allow the pan to happen.