# WL Configurator — Roadmap



## v1.2
- Mobile Website (new branch + sub branches for dev)
 - Review what triggers the mobile site (viewport width, browser agent, etc).
 - Ensure all triggers are dynamic.
 - Keep configuration preview unavailable through Models and Designs. On mobile, keep the 3D viewer hidden from normal stage views and make it available only as its own `3D Preview` view from the menu after a design is selected.
 - Use only Back/Menu behavior for the mobile navigation controls.
 - Make the footer from the desktop permanent and add Back/Menu controls. Keep the effect, but keep it to the bottom of the screen instead of slightly above.
 - Move the nav bar into a hamburger menu icon in the top left in a persistent header that shares space with the WoodLab logo. Make it look spatially balanced horizontally, keep the logo size contained by the header size, and move the Light/Dark/System toggle to the bottom of the menu. The menu will come onto the screen from the left side and fill the whole screen; the hamburger icon animates and turns into an X icon in the top right of the menu while it fully opens. Tapping the X, swiping left, or selecting a stage will close the menu, except Models, where the menu only closes if the user picks "Yes" in the dialog.
 - Add URL modifiers # using numbers to allow for link sharing in the config app and use this to replace the copy/paste button action in the Summary page (plan before implementing).
 - Decide whether to keep, replace, or remove the html2canvas self-screenshot flow for adding an example image to the PDF (currently not in use).

- Add a way to display edge customizations in the viewer (edge_profile_3d_preview_plan.md).
- Add Chair models.
- Add the option to toggle tabletop legs and chairs in the 3D viewer (separate toggles for each and put the controls in the viewer controls section):
When un-selected, give the legs 80% transparency instead of fully hiding them. Make chairs fully hidden.
By default, make legs unchecked until a selection is made in the Legs page (or a design preset has already pre-filled the selection). If activated before leg design is chosen, use Squared.
Chairs are hidden by default.
- Add Desk model.
    - Add Sit-Stand Base option.
    - Add Monitor Arms Addon.
- Unhide Keystone option for conference tables and add dimension handling.
## v2.0
- Rebuild app in React.js to allow for updates to be pushed to branches and immediately reflect in-browser. (Confirm if this will happen on the internet because of browser caching.)
- Update all variable/object names in code to be recognizable to humans without significantly increasing character count/codebase size.

## v2.x
 - Ability to upload and move logos within the viewer.
 - Screensaver (prompt after 5min inactivity w/ 15sec countdown), then start a full-view slideshow of slowly panned imagery that goes away when the mouse is moved. Images are to be zoomed in to allow the pan to happen.
 - "Build" Button in viewer controls that allows the viewer to play an animation of all the 3D models in a way that builds and assembles the table, revealing all features and parts.
