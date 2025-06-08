// WoodLab Configurator - main.js
// Global state and app bootstrap

export const state = {
  stage: 1, // 1: Model, 2: Customize, 3: Summary
  selections: { model: null, options: {} },
  pricing: { base: 12480, extras: 0, total: 12480 }
};

// Dispatch a custom event when state changes
export function setState(newState) {
  Object.assign(state, newState);
  document.dispatchEvent(new Event("statechange"));
}

// Stage navigation logic
function goToStage(stageNum) {
  if (stageNum < 1 || stageNum > 3) return;
  setState({ stage: stageNum });
  updateStageBar();
  updateSidebar();
}

// Update stage bar UI
function updateStageBar() {
  const stageBtns = document.querySelectorAll(".stage-btn");
  stageBtns.forEach((btn, idx) => {
    btn.classList.remove("bg-gray-900", "text-white", "bg-gray-200", "text-gray-700");
    btn.removeAttribute("aria-current");
    if (idx + 1 === state.stage) {
      btn.classList.add("bg-gray-900", "text-white");
      btn.setAttribute("aria-current", "step");
    } else {
      btn.classList.add("bg-gray-200", "text-gray-700");
    }
    btn.disabled = idx + 1 > state.stage;
    btn.style.pointerEvents = idx + 1 > state.stage ? "none" : "auto";
  });

  // Prev/Next button states
  const prevBtn = document.getElementById("prev-stage");
  const nextBtn = document.getElementById("next-stage");
  prevBtn.disabled = state.stage === 1;
  prevBtn.classList.toggle("opacity-40", state.stage === 1);
  prevBtn.classList.toggle("cursor-default", state.stage === 1);
  nextBtn.disabled = state.stage === 3;
  nextBtn.classList.toggle("opacity-40", state.stage === 3);
  nextBtn.classList.toggle("cursor-default", state.stage === 3);
}

const modelOptions = [
  {
    id: "mdl-01",
    name: "Model One",
    price: 12480,
    img: "assets/images/model1.svg",
    desc: "Classic rectangular table."
  },
  {
    id: "mdl-02",
    name: "Model Two",
    price: 13200,
    img: "assets/images/model2.svg",
    desc: "Round table, modern style."
  },
  {
    id: "mdl-03",
    name: "Model Three",
    price: 14100,
    img: "assets/images/model3.svg",
    desc: "Expandable dining table."
  }
];

// Update sidebar sections
function updateSidebar() {
  for (let i = 1; i <= 3; i++) {
    const section = document.getElementById(`stage${i}-section`);
    if (section) section.classList.toggle("hidden", state.stage !== i);
  }
  // Render model options in stage 1
  if (state.stage === 1) {
    renderModelOptions();
  }
}

function renderModelOptions() {
  const section = document.getElementById("stage1-section");
  if (!section) return;
  section.innerHTML = `
    <h2 class="text-lg font-bold mb-4">Select Model</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${modelOptions.map(opt => `
        <button
          class="option-card border rounded-lg p-3 flex flex-col items-center text-left transition
            ${state.selections.model === opt.id ? "border-gray-900 ring-2 ring-gray-900 font-bold" : "border-gray-300"}
          "
          data-id="${opt.id}"
          data-price="${opt.price}"
          aria-pressed="${state.selections.model === opt.id}"
        >
          <img src="${opt.img}" alt="placeholder" class="w-24 h-24 object-cover mb-2 bg-gray-200 rounded" />
          <div class="flex items-center w-full justify-between">
            <span class="label">${opt.name}</span>
            <span class="ml-2 text-xs text-gray-500">$${opt.price.toLocaleString()}</span>
          </div>
          <span class="text-xs text-gray-500 mt-1">${opt.desc}</span>
          ${state.selections.model === opt.id ? `<span class="absolute top-2 right-2 text-green-600 font-bold text-lg">&#10003;</span>` : ""}
        </button>
      `).join("")}
    </div>
  `;
  // Add event listeners
  section.querySelectorAll(".option-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const price = parseInt(btn.getAttribute("data-price"), 10);
      setState({
        selections: { ...state.selections, model: id },
        pricing: { ...state.pricing, base: price, total: price }
      });
      renderModelOptions();
    });
  });
}

// Price animation
function animatePrice(newTotal) {
  const priceBar = document.getElementById("price-bar");
  if (!priceBar) return;
  const oldTotal = state.pricing.total;
  let start = oldTotal, end = newTotal, duration = 400, step = 0;
  const steps = 24, increment = (end - start) / steps;
  function tick() {
    step++;
    const val = Math.round(start + increment * step);
    priceBar.innerHTML = `$${val.toLocaleString()} <span class="text-xs font-normal">USD</span>`;
    if (step < steps) setTimeout(tick, duration / steps);
    else priceBar.innerHTML = `$${end.toLocaleString()} <span class="text-xs font-normal">USD</span>`;
  }
  tick();
}

// Event listeners for navigation
document.addEventListener("DOMContentLoaded", () => {
  updateStageBar();
  updateSidebar();

  document.getElementById("prev-stage").addEventListener("click", () => {
    if (state.stage > 1) goToStage(state.stage - 1);
  });
  document.getElementById("next-stage").addEventListener("click", () => {
    if (state.stage < 3) goToStage(state.stage + 1);
  });

  // Stage bar direct navigation (if allowed)
  document.querySelectorAll(".stage-btn").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      if (idx + 1 <= state.stage) goToStage(idx + 1);
    });
  });

  // Help drawer
  const helpBtn = document.getElementById("help-btn");
  const helpDrawer = document.getElementById("help-drawer");
  const helpBackdrop = document.getElementById("help-backdrop");
  const helpClose = document.getElementById("help-close");
  helpBtn.addEventListener("click", () => openHelpDrawer());
  helpClose.addEventListener("click", () => closeHelpDrawer());
  helpBackdrop.addEventListener("click", () => closeHelpDrawer());
  document.addEventListener("keydown", (e) => {
    if (helpDrawer.classList.contains("translate-x-0") && e.key === "Escape") closeHelpDrawer();
  });

  function openHelpDrawer() {
    helpDrawer.classList.remove("translate-x-full");
    helpDrawer.classList.add("translate-x-0");
    helpDrawer.setAttribute("aria-hidden", "false");
    helpBtn.setAttribute("aria-expanded", "true");
    helpBackdrop.classList.remove("hidden");
    helpDrawer.focus();
  }
  function closeHelpDrawer() {
    helpDrawer.classList.add("translate-x-full");
    helpDrawer.classList.remove("translate-x-0");
    helpDrawer.setAttribute("aria-hidden", "true");
    helpBtn.setAttribute("aria-expanded", "false");
    helpBackdrop.classList.add("hidden");
    helpBtn.focus();
  }
});

// Listen for state changes to update UI
document.addEventListener("statechange", () => {
  updateStageBar();
  updateSidebar();
  animatePrice(state.pricing.total);
});
