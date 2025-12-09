# WoodLab Configurator - Code Audit Report
**Date:** December 8, 2025  
**Branch:** Legs-dev-20251204

---

## Executive Summary

The WoodLab Configurator is designed as an 8-stage wizard with a canonical state management pattern where:
1. **Stage modules** dispatch events (`option-selected`, `addon-toggled`, `request-restart`, `request-stage-change`)
2. **`main.js`** is the sole mutator of global state
3. **`stageManager.js`** orchestrates stage navigation with gating rules

**Overall Status:** ⚠️ **FUNCTIONAL WITH ISSUES** - The flow works end-to-end but has 10 identified issues ranging from critical to moderate.

---

## Intended User Flow

```
Stage 0: Models             → Requires: 1 model selection
    ↓
Stage 1: Designs            → Requires: 1 design selection (filtered by model)
    ↓
Stage 2: Materials          → Requires: material + color (2 selections)
    ↓
Stage 3: Finish             → Requires: coating + sheen (2 selections w/ constraints)
    ↓
Stage 4: Dimensions         → Requires: length + width + height preset/custom
    ↓
Stage 5: Legs               → Requires: legs, tube-size*, leg-finish* (*unless leg-none)
    ↓
Stage 6: Add-ons (OPTIONAL) → Multi-select, no gating
    ↓
Stage 7: Summary & Export   → View config, export PDF, start over
```

**Key Design Principles:**
- Each stage is **independent**; clicking stage buttons allows free navigation between completed stages
- Once all required stages (0-5) are complete, stages 6-7 unlock for free navigation
- Add-ons (stage 6) is optional and doesn't block advancement
- Price is **computed dynamically** from `state.selections` + data files

---

## Critical Issues (Will Block Users)

### **Issue #1: Duplicate Stage Modules (`models.js` vs `model.js`)**
**Severity:** 🔴 CRITICAL  
**File:** `js/stages/models.js` and `js/stages/model.js` both exist

**Problem:**
- `stageManager.js` imports `modelsStageModule` from `js/stages/models.js` (line 31)
- But `model.js` also exists with nearly identical code
- `model.js` dispatches an extra `stage-model-selected` event that's never used
- **Causes confusion and maintenance risk**

**Impact:**
- Unclear which module is "source of truth"
- `model.js` is dead code
- Potential for future edits to wrong file

**Recommendation:**
- Delete `js/stages/model.js`
- Keep `js/stages/models.js`

---

### **Issue #2: Design Options Never Load**
**Severity:** 🔴 CRITICAL  
**Files:** `js/main.js`, `js/stages/designs.js`

**Problem:**
- In `main.js` lines 267-310, code loads and renders **models, materials, finish, legs, addons**
- **Designs data is never loaded or rendered**
- `designs.js` only wires click handlers; no option cards are created
- When user reaches stage 1 (Designs), they see an empty stage

**Impact:**
- Stage 1 is completely non-functional
- User cannot select a design
- Cannot advance past stage 1

**Recommendation:**
Add to `main.js` after line 310:
```javascript
const designsRoot = document.getElementById('stage-1-placeholder');
if (designsRoot) {
  const designs = await loadData('data/designs.json');
  if (designs) renderOptionCards(designsRoot, designs, { category: null });
}
```

---

### **Issue #3: Legs/Tube Size Options Not Initialized with Global Data**
**Severity:** 🔴 CRITICAL  
**Files:** `js/main.js`, `js/stages/legCompatibility.js`

**Problem:**
- In `main.js` lines 94-107, `updateLegsOptionsForModel()` tries to filter legs using:
  - `window._allLegsData` and `window._allTubeSizesData` (global vars)
- **These globals are never initialized anywhere in the codebase**
- Leg filtering silently fails
- When user changes model, leg options don't update

**Impact:**
- Leg/tube size filtering by model doesn't work
- User may see incompatible combinations

**Recommendation:**
In `main.js` DOMContentLoaded, after loading leg data:
```javascript
const allLegs = await loadData('data/legs.json');
const allTubeSizes = await loadData('data/tube-sizes.json');
window._allLegsData = allLegs || [];
window._allTubeSizesData = allTubeSizes || [];
```

---

## High-Priority Issues (Will Cause User Confusion)

### **Issue #4: Finish Defaults Applied But Visual State Not Set**
**Severity:** 🟠 HIGH  
**File:** `js/stageManager.js` lines 150-158

**Problem:**
- When advancing to stage 3+ (Finish), `applyFinishDefaults(appState)` is called
- This **dispatches events** to set defaults (2K Poly coating, Satin sheen)
- But the finish cards in the DOM are not visually marked as pressed
- User sees empty finish stage even though defaults are selected in state

**Impact:**
- Confusing UX; user thinks they need to select something
- Price is correct, but UI doesn't reflect it
- Visual consistency broken

**Recommendation:**
In `applyFinishDefaults()` (after dispatching events), ensure DOM cards are visually updated:
```javascript
setTimeout(() => {
  const coatingEl = document.querySelector('.option-card[data-id="fin-coat-02"]');
  const sheenEl = document.querySelector('.option-card[data-id="fin-sheen-01"]');
  if (coatingEl) coatingEl.setAttribute('aria-pressed', 'true');
  if (sheenEl) sheenEl.setAttribute('aria-pressed', 'true');
}, 100);
```

---

### **Issue #5: Finish Constraints Not Reapplied on Stage Re-entry**
**Severity:** 🟠 HIGH  
**File:** `js/stages/finish.js` line 101-118 (restoreFromState)

**Problem:**
- When user navigates back to Finish stage (stage 3), `restoreFromState()` is called
- It restores visual pressed state of cards
- **But it does NOT call `recomputeFinishConstraints()`**
- User can now select incompatible sheen + coating combinations
- Price calculation may be wrong

**Impact:**
- User can configure invalid states
- Constraints lost on re-entry
- Potential for invalid orders

**Recommendation:**
Add to `finish.js` `restoreFromState()`:
```javascript
export function restoreFromState(state) {
  try {
    const coating = state.selections?.options?.['finish-coating'];
    const sheen = state.selections?.options?.['finish-sheen'];
    
    if (coating) {
      const el = document.querySelector(`.option-card[data-id="${coating}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="finish-coating"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }
    if (sheen) {
      const el = document.querySelector(`.option-card[data-id="${sheen}"]`);
      if (el) {
        document.querySelectorAll('.option-card[data-category="finish-sheen"]').forEach(c => c.setAttribute('aria-pressed', 'false'));
        el.setAttribute('aria-pressed', 'true');
      }
    }
    // CRITICAL: Recompute constraints after restore
    recomputeFinishConstraints();
  } catch (e) { /* ignore */ }
}
```

---

### **Issue #6: Legs UIVisibility Clears State Without Notification**
**Severity:** 🟠 HIGH  
**File:** `js/stages/legs.js` lines 125-138 (updateLegsUIVisibility)

**Problem:**
- When user selects "leg-none", tube size and leg finish sections are hidden
- The function **clears selections** (lines 134-138) but doesn't dispatch events
- This means state is cleared without `main.js` knowing
- Price calculation is out of sync with DOM

**Impact:**
- State inconsistency
- Price doesn't update when "leg-none" is selected
- If user re-enters leg stage, orphaned selections may cause issues

**Recommendation:**
After clearing selections, dispatch events:
```javascript
document.dispatchEvent(new CustomEvent('option-selected', 
  { detail: { id: null, price: 0, category: 'tube-size' } }));
document.dispatchEvent(new CustomEvent('option-selected', 
  { detail: { id: null, price: 0, category: 'leg-finish' } }));
```

---

## Medium-Priority Issues (Impact on Maintainability)

### **Issue #7: Dimensions Stage Module Very Large (569 Lines)**
**Severity:** 🟡 MEDIUM  
**File:** `js/stages/dimensions.js` (569 lines)

**Problem:**
- Dimensions is the largest stage module by far (others are 40-120 lines)
- Contains complex input validation, preset selection, custom controls
- Hard to navigate; increased maintenance risk
- Many helper functions not clearly documented

**Impact:**
- Harder to maintain
- Bugs harder to find/fix
- Team learning curve steep

**Recommendation:**
- No immediate action needed, but consider refactoring:
  - Extract validation logic to separate utility
  - Break into smaller modules if complexity grows further

---

### **Issue #8: Stage Completion Gating Checked Multiple Times**
**Severity:** 🟡 MEDIUM  
**File:** `js/stageManager.js` lines 127-200 (setStage) + lines 402-470 (option-selected handler)

**Problem:**
- Stage completion checked in 3 places:
  1. `nextStage()` at line 127
  2. `setStage()` gating logic at lines 136-200
  3. `option-selected` event handler at lines 402-470
- Triple-check creates maintenance burden
- Logic can diverge between places
- Easy to miss one place when adding new stage

**Impact:**
- Inconsistent gating rules across code
- Hard to debug why user can/can't advance
- Future edits risk breaking existing logic

**Recommendation:**
- Consolidate completion checks into single `isStageComplete(index)` function
- Use that function everywhere
- Example:
```javascript
function isStageComplete(index) {
  if (index === 0) return !!appState.selections.model;
  if (index === 1) return !!appState.selections.design;
  if (index === 2) {
    return !!(appState.selections.options.material && appState.selections.options.color);
  }
  // ... etc
}
```

---

### **Issue #9: Material Panel Rendered to Unknown Location**
**Severity:** 🟡 MEDIUM  
**File:** `js/main.js` lines 267-272

**Problem:**
- Code attempts to render materials to `#materials-options`
- But unclear if that element exists or where it is
- Sidebar includes `MaterialsPanel.html` via `data-include`
- Race condition: `data-include` processed asynchronously; materials render may fire before include completes

**Impact:**
- Materials may not render if timing is wrong
- Difficult to debug rendering issues

**Recommendation:**
- Wait for all `data-include` to finish before rendering materials
- Or move materials rendering into event after sidebar fully loaded

---

### **Issue #10: Summary PDF Export Snapshot May Capture Empty Container**
**Severity:** 🟡 MEDIUM  
**File:** `js/stages/summary.js` lines 44-59

**Problem:**
- `captureSnapshot()` captures from `#snapshot-container`
- Container is initially empty (just shows placeholder text)
- User must click "Capture Snapshot" to fill it first
- If user clicks "Export PDF" without capturing, blank PDF is generated
- No warning shown

**Impact:**
- User may export useless PDFs
- Confusing UX; unclear what "Capture" does vs "Export"

**Recommendation:**
- Modify export flow to auto-capture if snapshot empty:
```javascript
async function exportPdf() {
  const imgEl = document.getElementById('snapshot-img');
  if (!imgEl || imgEl.style.display === 'none') {
    // Auto-capture if not already captured
    await captureSnapshot();
  }
  // ... rest of export logic
}
```

---

## Summary of Findings

### Issues by Category
| **Severity** | **Count** | **Type** |
|---|---|---|
| 🔴 Critical | 3 | Blocks functionality |
| 🟠 High | 3 | Causes user confusion |
| 🟡 Medium | 4 | Maintainability/UX |

### Issues by Component
| **Component** | **Issues** |
|---|---|
| `main.js` | #1, #3, #8 |
| `stageManager.js` | #4, #8 |
| `designs.js` / `models.js` | #1, #2 |
| `finish.js` | #5 |
| `legs.js` | #6 |
| `dimensions.js` | #7 |
| `summary.js` | #10 |

---

## Verification Checklist

After fixes applied, verify:

- [ ] Design options render and are selectable on stage 1
- [ ] Changing model on stage 0 updates leg/tube-size options on stage 5
- [ ] Finish defaults visually appear when entering stage 3
- [ ] Navigating back to stage 3 (Finish) maintains constraints
- [ ] Selecting "leg-none" on stage 5 hides tube/leg-finish and updates price
- [ ] All 8 stages progress in order with proper gating
- [ ] Restart button on stage 7 resets everything and returns to stage 0
- [ ] PDF export captures current snapshot or auto-captures if empty

---

## Recommendations

### Immediate (Do Today)
1. ✅ Delete `js/stages/model.js` (duplicate)
2. ✅ Load and render designs in `main.js`
3. ✅ Initialize `window._allLegsData` and `window._allTubeSizesData`
4. ✅ Fix finish constraints on stage re-entry

### Short-term (This Week)
5. ✅ Fix finish defaults visual state
6. ✅ Fix legs UI visibility state clearing
7. ✅ Auto-capture snapshot before PDF export
8. ⏭️ Refactor dimensions stage if needed

### Long-term (Future Maintenance)
9. ⏭️ Consolidate stage completion checks
10. ⏭️ Better material panel rendering coordination

---

**Audit completed by:** AI Assistant  
**Last updated:** 2025-12-08 (timestamp to be updated after all fixes applied)
