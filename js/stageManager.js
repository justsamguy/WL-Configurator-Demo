// Minimal stage manager for WL Configurator
// Responsibilities:
// - Track current stage index
// - Enable/disable stage buttons
// - Prev/Next navigation with simple gating rules
// - React to model selection events to set price and mark stage complete

const STAGES = [
  'Models',
  'Designs',
  'Materials',
  'Finish',
  'Dimensions',
  'Legs',
  'Add-ons',
  'Summary & Export'
];

import { loadComponent } from './app.js';
import { state as appState, setState } from './state.js';
// helper from placeholders to recompute finish constraints when selections are set programmatically
import { recomputeFinishConstraints } from './ui/placeholders.js';
import { applyFinishDefaults } from './stages/finish.js';
import { computePrice } from './pricing.js';
import { showBanner } from './ui/banner.js';
import { init as initModelsStage } from './stages/models.js';
import { init as initDesignsStage } from './stages/designs.js';
import materialsStage, { init as initMaterialsStage } from './stages/materials.js';
import finishStage, { init as initFinishStage } from './stages/finish.js';
import dimensionsStage from './stages/dimensions.js';
import legsStage from './stages/legs.js';
import addonsStage from './stages/addons.js';
import summaryStage from './stages/summary.js';
import modelsStageModule from './stages/models.js';
import designsStageModule from './stages/designs.js';

const managerState = {
  current: 0,
  completed: new Array(STAGES.length).fill(false),
  config: {
    model: null,
    material: null,
    finish: null,
    dimensions: {},
    legs: null,
    addons: [],
    price: 0
  }
};

// Stages that are optional (no selection required to advance)
const OPTIONAL_STAGES = [6]; // index 6 = 'Add-ons'

function $(sel) {
  return document.querySelector(sel);
}

function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function formatPrice(centsOrUnits) {
  // Input is USD in whole units in this repo; keep simple formatting
  return `$${Number(centsOrUnits).toLocaleString()}`;
}

function showConfirmDialog(message, cancelText = 'Cancel', confirmText = 'Confirm') {
  return new Promise((resolve) => {
    // Create modal backdrop
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; pointer-events: auto;';
    
    // Create dialog box
    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = 'background-color: white; border-radius: 0.5rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); padding: 2rem; max-width: 28rem; width: 90%; pointer-events: auto;';
    dialogBox.innerHTML = `
      <p class="text-gray-900 text-base mb-8">${message}</p>
      <div class="flex justify-end gap-3">
        <button class="px-5 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition" id="confirm-cancel">${cancelText}</button>
        <button class="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition" id="confirm-ok">${confirmText}</button>
      </div>
    `;
    
    modal.appendChild(dialogBox);
    
    const onCancel = () => {
      modal.remove();
      resolve(false);
    };
    const onConfirm = () => {
      modal.remove();
      resolve(true);
    };
    
    // Close on Escape key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    
    document.body.appendChild(modal);
    
    dialogBox.querySelector('#confirm-cancel').addEventListener('click', onCancel);
    dialogBox.querySelector('#confirm-ok').addEventListener('click', onConfirm);
    document.addEventListener('keydown', handleKeydown);
    
    // Focus the confirm button for better UX
    dialogBox.querySelector('#confirm-ok').focus();
  });
}

async function updateLivePrice() {
  // Primary price container: sidebar #price-bar. Keep fallback to legacy header #live-price
  const sidebarPrice = document.getElementById('price-bar');
  if (sidebarPrice) {
    // compute authoritative price using shared state where possible
    try {
      const p = await computePrice(appState);
      sidebarPrice.textContent = formatPrice(p.total || (managerState.config.price || 0));
      return;
    } catch (e) {
      // fallback
      sidebarPrice.textContent = formatPrice(managerState.config.price || 0);
      return;
    }
    return;
  }
  const elAmount = $('#live-price .price-amount');
  if (!elAmount) return;
  elAmount.textContent = formatPrice(managerState.config.price || 0);
}

async function setStage(index, options = {}) {
  // options: { allowSkip: boolean, skipConfirm: boolean }
  if (index < 0 || index >= STAGES.length) return;
  
  // Special handling: if navigating back to Models (index 0) and design is already selected,
  // show confirmation dialog unless skipConfirm is true
  if (index === 0 && appState.selections.design && !options.skipConfirm) {
    const confirmed = await showConfirmDialog(
      'Changing models will clear your design selection. Continue?',
      'Cancel',
      'Change Model'
    );
    if (!confirmed) return;
    // User confirmed, proceed with clear design
    setState({ selections: { ...appState.selections, design: null } });
  }
  
  // gating: normally prevent jumping forward past first incomplete required stage
  // but callers can pass { allowSkip: true } to bypass the gating (used by Next button)
  if (index > managerState.current && !options.allowSkip) {
    // require model selected to advance beyond stage 0 (Models)
    if (managerState.current <= 0 && !appState.selections.model) {
      return;
    }
    // require design selected to advance beyond stage 1 (Designs)
    // But only gate if we're trying to advance PAST the Designs stage (stage 1)
    if (managerState.current === 1 && index > 1 && !appState.selections.design) {
      return;
    }
    // If attempting to move to the Materials stage (index 2), validate as before
    try {
      if (index >= 3) {
        const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
        const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
        if (!hasMaterial || !hasColor) {
          return;
        }
        // Ensure Finish stage has sensible defaults: select 2K Poly coating and Satin sheen if
        // they are not already selected. This updates the shared app state and triggers UI restoration.
        try {
          // delegate finish defaults to dedicated module
          applyFinishDefaults(appState);
          // Ensure visual state is updated on DOM after defaults applied
          setTimeout(() => {
            try {
              const coatingEl = document.querySelector('.option-card[data-id="fin-coat-02"]');
              const sheenEl = document.querySelector('.option-card[data-id="fin-sheen-01"]');
              if (coatingEl && !appState.selections.options?.['finish-coating']) {
                coatingEl.setAttribute('aria-pressed', 'true');
              }
              if (sheenEl && !appState.selections.options?.['finish-sheen']) {
                sheenEl.setAttribute('aria-pressed', 'true');
              }
            } catch (e) { /* ignore */ }
          }, 100);
        } catch (e) {
          console.warn('Failed to apply finish defaults via module:', e);
        }
      }
      // If attempting to move past Legs or beyond (index > 5), require legs, tube-size, and leg-finish
      // (unless "none" leg is selected, which doesn't require tube-size or leg-finish)
      // (or custom leg is selected, which makes tube-size optional)
      if (index > 5) {
        const hasLegs = !!(appState.selections && appState.selections.options && appState.selections.options.legs);
        const legId = appState.selections && appState.selections.options && appState.selections.options.legs;
        const isNoneLeg = legId === 'leg-none';
        const isCustomLeg = legId === 'leg-sample-07';

        if (!hasLegs) {
          return;
        }

        // If not "none" leg, require tube-size (unless custom leg) and leg-finish
        if (!isNoneLeg) {
          const hasTubeSize = !!(appState.selections && appState.selections.options && appState.selections.options['tube-size']);
          const hasLegFinish = !!(appState.selections && appState.selections.options && appState.selections.options['leg-finish']);
          const tubeSizeRequired = !isCustomLeg;
          if ((tubeSizeRequired && !hasTubeSize) || !hasLegFinish) {
            return;
          }
        }
      }
      // Once all required selections through stage 5 (Legs) are complete, stages 6 (Add-ons) and 7 (Summary)
      // are fully unlocked and can be freely navigated between and back to previous stages.
      // No additional gating is needed for indices 6 and 7.
    } catch (e) {
      // if anything goes wrong reading appState, be conservative and block advance
      return;
    }
  }
  managerState.current = index;
  // treat optional stages as implicitly completed for gating decisions
  const currentCompleted = !!managerState.completed[managerState.current] || OPTIONAL_STAGES.includes(managerState.current);
  // Check if all required stages (0-5) are complete to unlock Add-ons (6) and Summary (7) for free navigation
  const allRequiredStagesComplete = managerState.completed[0] && managerState.completed[1] && managerState.completed[2] && 
                                    managerState.completed[3] && managerState.completed[4] && managerState.completed[5];
  
  // update buttons
  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    if (idx === managerState.current) {
      btn.setAttribute('aria-current', 'step');
      btn.disabled = false;
    } else {
      btn.removeAttribute('aria-current');
      // allow revisiting previous stages
      if (idx < managerState.current) {
        btn.disabled = false;
      } else {
        // For future stages (idx > current):
        // - if all required stages (0-5) are complete, allow free access to Add-ons (6) and Summary (7)
        // - otherwise, allow if that future stage is already completed or only the immediate next stage when current is completed
        if (idx >= 6 && allRequiredStagesComplete) {
          btn.disabled = false;
        } else if (managerState.completed[idx]) {
          btn.disabled = false;
        } else if (idx === managerState.current + 1 && currentCompleted) {
          btn.disabled = false;
        } else {
          btn.disabled = true;
        }
      }
    }
  });

  // Special handling for Models (0) and Designs (1) stages: move panel for full-width display
  // Do this BEFORE setting display styles so the panel is in the correct location
  const sidebar = document.getElementById('app-sidebar');
  const viewer = document.getElementById('viewer');
  const viewerControls = document.getElementById('viewer-controls-container');
  if (managerState.current === 0 || managerState.current === 1) {
    console.log(`[setStage] Entering stage ${managerState.current} - moving panel to mainContent`);
    // hide sidebar and viewer chrome; CSS will make the stage panel span full width
    if (sidebar) sidebar.style.display = 'none';
    if (viewer) viewer.style.display = 'none';
    if (viewerControls) viewerControls.style.display = 'none';
    // Move the Models/Designs panel out of the sidebar and into the main content area
    // so it can span the full viewport. We restore it to its original container
    // when leaving these stages.
    try {
      const panelId = `stage-panel-${managerState.current}`;
      let panel = document.getElementById(panelId);
      const root = document.getElementById('stage-panels-root');
      const mainContent = document.getElementById('app-main');
      
      console.log(`[setStage] Looking for panel: ${panelId}`);
      console.log(`[setStage] Panel found:`, !!panel, panel?.parentElement?.id);
      
      // If panel is not found, it might still be in mainContent from a previous stage
      // Try to restore any displaced panels first
      if (!panel && root && mainContent) {
        console.log(`[setStage] Panel not found by ID, searching in mainContent`);
        // Check if any stage-panel is currently in mainContent that shouldn't be
        const displacePanel = mainContent.querySelector('[id^="stage-panel-"]');
        if (displacePanel && displacePanel.id !== panelId) {
          console.log(`[setStage] Found displaced panel: ${displacePanel.id}, restoring to root`);
          root.appendChild(displacePanel);
        }
        // Now try to find the target panel again
        panel = document.getElementById(panelId);
        console.log(`[setStage] Panel found after cleanup:`, !!panel);
      }
      
      // If panel doesn't exist (e.g., StagePanels.html hasn't loaded yet or sidebar is hidden),
      // create it dynamically in mainContent for stages 0 and 1
      if (!panel && mainContent) {
        console.log(`[setStage] Panel ${panelId} not found, creating it dynamically in mainContent`);
        panel = document.createElement('section');
        panel.id = panelId;
        panel.className = 'stage-panel';
        panel.innerHTML = `<div id="stage-${managerState.current}-placeholder"></div>`;
        mainContent.innerHTML = '';
        mainContent.appendChild(panel);
        console.log(`[setStage] Created panel ${panelId} in mainContent`);
      } else if (panel && mainContent) {
        console.log(`[setStage] Appending panel ${panelId} to mainContent`);
        // remember that we moved it
        if (!panel.dataset.wlOrigParent) panel.dataset.wlOrigParent = 'stage-panels-root';
        // Clear any previous inline display style
        panel.style.display = '';
        // Move the panel into the main content area for full-width display
        // IMPORTANT: Do not clear mainContent.innerHTML if the panel is already there
        if (panel.parentElement !== mainContent) {
          mainContent.innerHTML = '';
          mainContent.appendChild(panel);
        }
        console.log(`[setStage] Panel appended. Parent now:`, panel.parentElement?.id);
      } else {
        console.warn(`[setStage] Could not append panel - panel:`, !!panel, 'root:', !!root, 'mainContent:', !!mainContent);
      }
      
      const componentPath = managerState.current === 0 ? 'components/ModelSelection.html' : 'components/ModelSelection.html'; // Both use same component, filtered by data
      // Use requestAnimationFrame to ensure DOM has updated before loading component
      await new Promise(resolve => requestAnimationFrame(resolve));
      console.log(`[setStage] Loading component for stage ${managerState.current}`);
      
      // Ensure the placeholder exists before loading component
      const placeholderId = `stage-${managerState.current}-placeholder`;
      let placeholder = document.getElementById(placeholderId);
      if (!placeholder && panel) {
        console.log(`[setStage] Placeholder ${placeholderId} not found in DOM, creating it inside panel`);
        panel.innerHTML = `<div id="${placeholderId}"></div>`;
        placeholder = document.getElementById(placeholderId);
      }
      
      // Ensure the placeholder has the expected component structure (e.g. .model-row-grid)
      const hasGrid = placeholder && placeholder.querySelector('.model-row-grid');
      if (placeholder && !hasGrid) {
        console.log(`[setStage] Placeholder ${placeholderId} missing grid structure, loading component`);
        await loadComponent(placeholderId, componentPath);
      } else if (placeholder) {
        console.log(`[setStage] Placeholder ${placeholderId} already has component structure, skipping loadComponent`);
      } else {
        console.warn(`[setStage] Could not find or create placeholder ${placeholderId}`);
      }
      // Restore visual selections when entering model/design selection stage
      setTimeout(async () => {
        try {
          if (managerState.current === 0) {
            modelsStageModule.restoreFromState && modelsStageModule.restoreFromState(appState);
          } else if (managerState.current === 1) {
            // Re-render designs filtered by selected model
            // Design filtering is data-driven: designs are shown based on their "prices" object in data/designs.json
            // If a design has a price for the selected model ID, it will be displayed
            try {
              const designsSection = document.getElementById('designs-stage-section');
              if (designsSection) {
                const { loadData } = await import('./dataLoader.js');
                const { renderOptionCards } = await import('./stageRenderer.js');
                const designs = await loadData('data/designs.json');
                if (designs) {
                const designGrids = designsSection.querySelectorAll('.stage-options-grid');
                if (designGrids && designGrids.length) {
                  // Filter designs based on selected model
                  const selectedModel = appState.selections && appState.selections.model;
                  const filteredDesigns = designs.filter(design => {
                    if (!selectedModel) return true;
                    // Design is available if it has pricing for this model
                    return design.prices && design.prices[selectedModel];
                  });
                  // Add price field for rendering
                  const designsWithPrice = filteredDesigns.map(design => ({
                    ...design,
                    price: selectedModel && design.prices ? design.prices[selectedModel] : 0
                  }));
                  renderOptionCards(designGrids[0], designsWithPrice, { category: null });
                }
                }
              }
            } catch (e) {
              console.warn('Failed to re-render designs on stage entry:', e);
            }
            designsStageModule.restoreFromState && designsStageModule.restoreFromState(appState);
          }
        } catch (e) {
          console.warn('Failed to restore selections on stage change:', e);
        }
      }, 100); // Small delay to ensure DOM is ready
    } catch (e) {
      // ignore load errors
    }
  } else {
    console.log(`[setStage] Exiting stages 0/1, restoring sidebar (now at stage ${managerState.current})`);
    // restore sidebar and viewer/chrome visibility
    if (sidebar) sidebar.style.display = '';
    if (viewer) viewer.style.display = '';
    if (viewerControls) viewerControls.style.display = '';
    // Clean up the stage placeholders to avoid duplicates and restore panels
    try {
      for (let i = 0; i <= 1; i++) {
        const panelId = `stage-panel-${i}`;
        const ph = document.getElementById(`stage-${i}-placeholder`);
        // Do NOT clear innerHTML here if we are just switching between stage 0 and 1,
        // as they share the same component and clearing it might cause flicker or issues
        // if the DOM hasn't fully updated.
        // However, when exiting to stage 2+, we should clean up.
        if (ph && managerState.current > 1) ph.innerHTML = '';
        
        // If we previously moved stage panel out of the sidebar, put it back
        let panel = document.getElementById(panelId);
        const root = document.getElementById('stage-panels-root');
        const mainContent = document.getElementById('app-main');
        
        console.log(`[setStage restore] Checking panel ${panelId}: found=`, !!panel, 'parent=', panel?.parentElement?.id);
        
        // Check both locations for the panel
        if (!panel && mainContent) {
          panel = mainContent.querySelector(`#${panelId}`);
          console.log(`[setStage restore] Found ${panelId} in mainContent:`, !!panel);
        }
        
        // Restore panel to root if it's not there already
        if (panel && root) {
          if (panel.parentElement !== root) {
            console.log(`[setStage restore] Restoring ${panelId} from ${panel.parentElement?.id} to root`);
            root.appendChild(panel);
          } else {
            console.log(`[setStage restore] ${panelId} already in root`);
          }
          delete panel.dataset.wlOrigParent;
        } else {
          console.warn(`[setStage restore] Could not restore ${panelId}: panel=`, !!panel, 'root=', !!root);
        }
      }
    } catch (e) { 
      console.error('[setStage restore] Error:', e);
    }
    // Restore UI for non-model stages
    try {
      const s = appState;
      console.log('[StageManager] Restoring stage', managerState.current, 'with state:', s.selections);
      if (managerState.current === 2) materialsStage.restoreFromState && materialsStage.restoreFromState(s);
      if (managerState.current === 3) finishStage.restoreFromState && finishStage.restoreFromState(s);
      if (managerState.current === 4) {
        // Load dimensions panel component if not already loaded
        const dimPh = document.getElementById('dimensions-panel-placeholder');
        if (dimPh && dimPh.innerHTML === '') {
          await loadComponent('dimensions-panel-placeholder', 'components/DimensionsPanel.html');
          // Initialize dimensions stage now that the panel is loaded
          if (dimensionsStage.init) await dimensionsStage.init();
        }
        dimensionsStage.restoreFromState && dimensionsStage.restoreFromState(s);
      }
      if (managerState.current === 5) {
        console.log('[StageManager] Entering Legs stage (5), state.selections.model:', s.selections.model);
        legsStage.restoreFromState && legsStage.restoreFromState(s);
      }
      if (managerState.current === 6) addonsStage.restoreFromState && addonsStage.restoreFromState(s);
      if (managerState.current === 7) summaryStage.restoreFromState && summaryStage.restoreFromState(s);
    } catch (e) { /* ignore */ }
  }

  // NOW set display styles for all panels (after moving them if needed)
  // show/hide stage content panels if present (convention: panels use id stage-panel-<index>)
  $all('[id^="stage-panel-"]').forEach(panel => {
    const idx = Number(panel.id.replace('stage-panel-', ''));
    panel.style.display = idx === managerState.current ? '' : 'none';
  });

  // Also hide/show the MaterialsPanel (containing materials-options and color-options containers)
  // only visible on stage 2 (Materials stage, now shifted due to Models/Designs)
  try {
    const materialsPanel = document.getElementById('materials-panel');
    if (materialsPanel) {
      materialsPanel.style.display = managerState.current === 2 ? '' : 'none';
    }
  } catch (e) {
    // ignore if materials panel not present
  }

  // Add a body-level class so CSS can easily show/hide model tiles across the app.
  // When not on the Models stage (now index 0), model tiles are hidden by default.
  try {
    document.body.classList.toggle('show-model-tiles', managerState.current === 0 || managerState.current === 1);
    // Add stage-specific classes for CSS visibility control
    for (let i = 0; i < STAGES.length; i++) {
      document.body.classList.toggle(`stage-${i}`, managerState.current === i);
    }
  } catch (e) {
    // document.body might not be available in some test contexts; ignore.
  }

  // Recompute and set accurate header height so main content doesn't tuck under it.
  try {
    const header = document.getElementById('app-header');
    if (header) {
      const h = header.offsetHeight || 0;
      document.documentElement.style.setProperty('--header-height', `${h}px`);
    }
  } catch (e) {
    // ignore
  }

  // Show only the sidebar info section that corresponds to the active stage (if present)
  try {
    const infos = document.querySelectorAll('#stage-info-root .sidebar-info');
    infos.forEach(sec => { sec.style.display = 'none'; });
    const active = document.getElementById(`info-stage-${managerState.current}`);
    if (active) active.style.display = '';
  } catch (e) {
    // ignore if stage info root not present
  }
  
  // After entering a stage, check if pre-selected options make it complete
  // This ensures stages with defaults (like Finish) are properly marked as complete
  // setTimeout(() => { // REMOVED: This causes infinite loop when combined with setStage calls
    try {
      if (managerState.current === 2) {
        // Materials stage: check if both material and color are selected
        const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
        const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
        markCompleted(2, !!(hasMaterial && hasColor));
      } else if (managerState.current === 3) {
        // Finish stage: check if coating, sheen, and tint are all selected
        const hasCoating = !!(appState.selections && appState.selections.options && appState.selections.options['finish-coating']);
        const hasSheen = !!(appState.selections && appState.selections.options && appState.selections.options['finish-sheen']);
        const hasTint = !!(appState.selections && appState.selections.options && appState.selections.options['finish-tint']);
        markCompleted(3, !!(hasCoating && hasSheen && hasTint));
      } else if (managerState.current === 4) {
        // Dimensions stage: check if dimensions are selected
        const dimOption = appState.selections && appState.selections.options && appState.selections.options.dimensions;
        markCompleted(4, !!dimOption);
      } else if (managerState.current === 5) {
        // Legs stage (index 5): require legs selected, and tube-size & leg-finish unless "none" leg is selected
        // (or custom leg is selected, which makes tube-size optional)
        const hasLegs = !!(appState.selections && appState.selections.options && appState.selections.options.legs);
        const legId = appState.selections && appState.selections.options && appState.selections.options.legs;
        const isNoneLeg = legId === 'leg-none';
        const isCustomLeg = legId === 'leg-sample-07';

        let isLegStageComplete = false;
        if (hasLegs) {
          if (isNoneLeg) {
            isLegStageComplete = true;
          } else {
            const hasTubeSize = !!(appState.selections && appState.selections.options && appState.selections.options['tube-size']);
            const hasLegFinish = !!(appState.selections && appState.selections.options && appState.selections.options['leg-finish']);
            const tubeSizeRequired = !isCustomLeg;
            isLegStageComplete = (tubeSizeRequired ? hasTubeSize : true) && hasLegFinish;
          }
        }
        markCompleted(5, isLegStageComplete);
      }
      // Update button states after checking completion (buttons are updated via markCompleted)
    } catch (e) {
      console.warn('Failed to check stage completion after entering stage:', e);
    }
  // }, 150);
}

function nextStage() {
  // If current stage isn't completed, block advancing
  if (!managerState.completed[managerState.current]) {
    return;
  }
  setStage(Math.min(managerState.current + 1, STAGES.length - 1));
}

function prevStage() {
  setStage(Math.max(managerState.current - 1, 0));
}

function getCurrentStage() {
  return managerState.current;
}

function markCompleted(index, completed = true) {
  if (index < 0 || index >= STAGES.length) return;
  managerState.completed[index] = completed;
  // enable next stage if current completed
  const nextIdx = index + 1;
  const nextBtn = document.querySelector(`#stage-bar .stage-btn[data-stage-index='${nextIdx}']`);
  if (nextBtn) nextBtn.disabled = !completed;
}

function wireStageButtons() {
  $all('#stage-bar .stage-btn').forEach(btn => {
    const idx = Number(btn.getAttribute('data-stage-index'));
    btn.addEventListener('click', () => setStage(idx));
  });
}

export function initStageManager() {
  // initial wiring
  wireStageButtons();
  // Initialize models and designs stage modules which wire option-card clicks
  try {
    initModelsStage();
  } catch (e) {
    console.warn('Failed to initialize models stage module', e);
  }
  try {
    initDesignsStage();
  } catch (e) {
    console.warn('Failed to initialize designs stage module', e);
  }
  // Initialize remaining stage modules
  try { initMaterialsStage(); } catch (e) { console.warn('Failed to init materials stage', e); }
  try { initFinishStage(); } catch (e) { console.warn('Failed to init finish stage', e); }
  try { dimensionsStage.init && dimensionsStage.init(); } catch (e) { /* ignore */ }
  try { legsStage.init && legsStage.init(); } catch (e) { /* ignore */ }
  try { addonsStage.init && addonsStage.init(); } catch (e) { /* ignore */ }
  try { summaryStage.init && summaryStage.init(); } catch (e) { /* ignore */ }
  // Mark stages completed only when ALL required selections are made
  document.addEventListener('option-selected', (ev) => {
    const { category } = ev.detail || {};
    
    try {
      // Models stage (index 0): mark complete only when model is selected
      if (category === 'model') {
        const hasModel = !!(appState.selections && appState.selections.model);
        markCompleted(0, !!hasModel);
        
        // When model changes, all other selections are cleared by main.js
        // Reset completion status for all dependent stages (1-5)
        markCompleted(1, false); // Designs
        markCompleted(2, false); // Materials
        markCompleted(3, false); // Finish
        markCompleted(4, false); // Dimensions
        markCompleted(5, false); // Legs
        
        // Update button states to reflect the reset completion status
        setStage(managerState.current, { skipConfirm: true });
        
        // Don't call setStage here; let user click Next or the Designs button to navigate
        return;
      }
      
      // Designs stage (index 1): mark complete only when design is selected
      if (category === 'design') {
        const hasDesign = !!(appState.selections && appState.selections.design);
        markCompleted(1, !!hasDesign);
        
        // Update button states to reflect the new completion status
        setStage(managerState.current, { skipConfirm: true });
        
        // Don't call setStage here; let user click Next or the Materials button to navigate
        return;
      }
      
      // For all other stages, validate completion based on current stage and update accordingly
      if (managerState.current === 2) {
        // Materials stage (index 2): require both material and color
        const hasMaterial = !!(appState.selections && appState.selections.options && appState.selections.options.material);
        const hasColor = !!(appState.selections && appState.selections.options && appState.selections.options.color);
        markCompleted(2, !!(hasMaterial && hasColor));
      } else if (managerState.current === 3) {
        // Finish stage (index 3): require coating, sheen, and tint
        const hasCoating = !!(appState.selections && appState.selections.options && (appState.selections.options['finish-coating'] || appState.selections.options.coating));
        const hasSheen = !!(appState.selections && appState.selections.options && (appState.selections.options['finish-sheen'] || appState.selections.options.sheen));
        const hasTint = !!(appState.selections && appState.selections.options && appState.selections.options['finish-tint']);
        markCompleted(3, !!(hasCoating && hasSheen && hasTint));
      } else if (managerState.current === 4) {
        // Dimensions stage (index 4): require a preset or custom dimensions selection
        // Check if a preset tile is selected or custom dimensions are provided
        const dimOption = appState.selections && appState.selections.options && appState.selections.options.dimensions;
        // dimOption is set when any dimension selection is made (preset or custom)
        markCompleted(4, !!dimOption);
      } else if (managerState.current === 5) {
        // Legs stage (index 5): require legs selected, and tube-size & leg-finish unless "none" leg is selected
        const hasLegs = !!(appState.selections && appState.selections.options && appState.selections.options.legs);
        const legId = appState.selections && appState.selections.options && appState.selections.options.legs;
        const isNoneLeg = legId === 'leg-none';
        
        let isLegStageComplete = false;
        if (hasLegs) {
          if (isNoneLeg) {
            // "none" leg requires no additional selections
            isLegStageComplete = true;
          } else {
            // Other legs require tube-size and leg-finish
            const hasTubeSize = !!(appState.selections && appState.selections.options && appState.selections.options['tube-size']);
            const hasLegFinish = !!(appState.selections && appState.selections.options && appState.selections.options['leg-finish']);
            isLegStageComplete = !!(hasTubeSize && hasLegFinish);
          }
        }
        markCompleted(5, isLegStageComplete);
      }
      
      // Also check legs stage completion if any legs-related category is selected (for button enable/disable on transitions)
      if (category === 'legs' || category === 'tube-size' || category === 'leg-finish') {
        const hasLegs = !!(appState.selections && appState.selections.options && appState.selections.options.legs);
        const legId = appState.selections && appState.selections.options && appState.selections.options.legs;
        const isNoneLeg = legId === 'leg-none';
        const isCustomLeg = legId === 'leg-sample-07';

        let isLegStageComplete = false;
        if (hasLegs) {
          if (isNoneLeg) {
            isLegStageComplete = true;
          } else {
            const hasTubeSize = !!(appState.selections && appState.selections.options && appState.selections.options['tube-size']);
            const hasLegFinish = !!(appState.selections && appState.selections.options && appState.selections.options['leg-finish']);
            const tubeSizeRequired = !isCustomLeg;
            isLegStageComplete = (tubeSizeRequired ? hasTubeSize : true) && hasLegFinish;
          }
        }
        markCompleted(5, isLegStageComplete);
      }
      // Stage 6 (Add-ons) is optional, so it's never marked as requiring completion
      // Stage 7 (Summary) is terminal; completion not tracked here
      
      // run a UI update to refresh Next/Prev/button states
      // setStage(managerState.current); // REMOVED: This causes infinite loop when triggered by state changes
    } catch (e) {
      console.warn('Error in option-selected handler:', e);
    }
  });

  // Handle addon-toggled events (addons are optional, so this just updates UI)
  document.addEventListener('addon-toggled', () => {
    // Addons stage is optional, but update UI state in case user is on that stage
    if (managerState.current === 6) {
      setStage(managerState.current);
    }
  });

  updateLivePrice();
  setStage(0);
}

// Use shared showBanner from ui/banner.js for consistent styling and accessibility.

// expose for debugging
window.__wlStage = { state: managerState, setStage, nextStage, prevStage, initStageManager };

export default { initStageManager, state: managerState, setStage, getCurrentStage };
