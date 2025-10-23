# WL-Configurator-Demo
A demo for a WL configurator app UI
<br>
<a href=https://justsamguy.github.io/WL-Configurator-Demo> https://justsamguy.github.io/WL-Configurator-Demo </a>

Note: the codebase now includes a centralized pricing helper at `js/pricing.js` and stage-specific logic under `js/stages/` (for example `js/stages/finish.js`).

Stage structure and state rules

- Each UI stage has a dedicated module under `js/stages/` (e.g. `js/stages/model.js`, `js/stages/materials.js`, `js/stages/finish.js`, etc.).
- Stage data lives in the `data/` folder as JSON files (for example `data/models.json`, `data/materials.json`, `data/finish.json`, ...). This enables editing a stage's data and logic independently.
- Important: only `js/main.js` should call `setState` to mutate the shared `state` object. Stage modules must dispatch selection events (`option-selected`, `addon-toggled`, `stage-model-selected`, `request-restart`) and rely on `js/main.js` to update the global state. This keeps stage edits isolated and prevents accidental cross-stage coupling.