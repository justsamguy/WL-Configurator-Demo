// WoodLab Configurator - main.js
// Global state and app bootstrap

export const state = {
  stage: 1, // 1: Model, 2: Customize, 3: Summary
  selections: { model: null, options: {} },
  pricing: { base: 12480, extras: 0, total: 12480 }
};

// Make state globally accessible for non-module scripts
window.state = state;

// Customization options
const customizationOptions = {
  material: [
    { id: "mat-01", name: "Oak", price: 0, img: "assets/images/model1.svg", desc: "Classic oak wood." },
    { id: "mat-02", name: "Walnut", price: 850, img: "assets/images/model1.svg", desc: "Rich walnut finish." },
    { id: "mat-03", name: "Maple", price: 450, img: "assets/images/model1.svg", desc: "Light maple wood." }
  ],
  finish: [
    { id: "fin-01", name: "Natural", price: 0, img: "assets/images/model1.svg", desc: "Clear coat finish." },
    { id: "fin-02", name: "Stained", price: 350, img: "assets/images/model1.svg", desc: "Dark stain applied." }
  ],
  legs: [
    { id: "leg-01", name: "Standard", price: 0, img: "assets/images/model1.svg", desc: "Traditional legs." },
    { id: "leg-02", name: "Modern", price: 250, img: "assets/images/model1.svg", desc: "Contemporary design." }
  ]
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
  // Render customization options in stage 2
  else if (state.stage === 2) {
    renderCustomizationOptions();
  }
  // Render summary in stage 3
  else if (state.stage === 3) {
    renderSummary();
  }
}

function renderModelOptions() {
  const container = document.getElementById("model-options");
  if (!container) return;
  container.innerHTML = `
      ${modelOptions.map(opt => `
        <button
          class="option-card border rounded-lg p-3 flex flex-col items-center text-left transition w-full
            ${state.selections.model === opt.id ? "border-blue-600 ring-2 ring-blue-200 font-semibold" : "border-gray-300 bg-white"}
          "
          data-id="${opt.id}"
          data-price="${opt.price}"
          aria-pressed="${state.selections.model === opt.id}"
        >
          <img src="${opt.img}" alt="placeholder" class="w-full h-24 object-cover mb-3 bg-gray-100 rounded-md" />
          <div class="flex items-center w-full justify-between">
            <span class="label text-sm">${opt.name}</span>
            <span class="ml-2 text-xs text-gray-600">$${opt.price.toLocaleString()}</span>
          </div>
          <span class="text-xs text-gray-500 mt-1 self-start">${opt.desc}</span>
          ${state.selections.model === opt.id ? `<div class="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></div>` : ""}
        </button>
      `).join("")}
  `;
  // Add event listeners
  container.querySelectorAll(".option-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const price = parseInt(btn.getAttribute("data-price"), 10);
      setState({
        selections: { ...state.selections, model: id },
        pricing: { ...state.pricing, base: price, total: price + state.pricing.extras }
      });
      
      // Update 3D model
      try {
        // Try to access the updateModel function from viewer.js
        if (typeof updateModel === 'function') {
          updateModel(id);
        }
      } catch (error) {
        console.warn("Could not update 3D model:", error);
      }
      
      renderModelOptions();
    });
  });
}

// Render customization options for stage 2
function renderCustomizationOptions() {
  const container = document.getElementById("stage2-section");
  if (!container) return;
  
  // Create HTML for each category
  const categories = Object.keys(customizationOptions);
  
  container.innerHTML = `
    <h2 class="text-lg font-semibold mb-4">Customize Your Model</h2>
    ${categories.map(category => `
      <div class="mb-6">
        <h3 class="text-md font-semibold mb-2 capitalize">${category}</h3>
        <div class="grid grid-cols-1 gap-4">
          ${customizationOptions[category].map(opt => `
            <button
              class="option-card border rounded-lg p-3 flex flex-col items-center text-left transition w-full
                ${state.selections.options[category] === opt.id ? "border-blue-600 ring-2 ring-blue-200 font-semibold" : "border-gray-300 bg-white"}
              "
              data-category="${category}"
              data-id="${opt.id}"
              data-price="${opt.price}"
              aria-pressed="${state.selections.options[category] === opt.id}"
            >
              <img src="${opt.img}" alt="placeholder" class="w-full h-16 object-cover mb-3 bg-gray-100 rounded-md" />
              <div class="flex items-center w-full justify-between">
                <span class="label text-sm">${opt.name}</span>
                <span class="ml-2 text-xs text-gray-600">${opt.price > 0 ? '+' : ''}$${opt.price.toLocaleString()}</span>
              </div>
              <span class="text-xs text-gray-500 mt-1 self-start">${opt.desc}</span>
              ${state.selections.options[category] === opt.id ? `<div class="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg></div>` : ""}
            </button>
          `).join("")}
        </div>
      </div>
    `).join("")}
  `;
  
  // Add event listeners
  container.querySelectorAll(".option-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const category = btn.getAttribute("data-category");
      const id = btn.getAttribute("data-id");
      const price = parseInt(btn.getAttribute("data-price"), 10);
      
      // Calculate new extras price
      let newExtras = 0;
      const newOptions = { ...state.selections.options, [category]: id };
      
      // Sum up all selected options prices
      Object.keys(newOptions).forEach(cat => {
        if (newOptions[cat]) {
          const selectedOption = customizationOptions[cat].find(opt => opt.id === newOptions[cat]);
          if (selectedOption) {
            newExtras += selectedOption.price;
          }
        }
      });
      
      setState({
        selections: { 
          ...state.selections, 
          options: newOptions
        },
        pricing: { 
          ...state.pricing, 
          extras: newExtras,
          total: state.pricing.base + newExtras
        }
      });
      
      renderCustomizationOptions();
    });
  });
}

// Render summary for stage 3
function renderSummary() {
  const container = document.getElementById("stage3-section");
  if (!container) return;
  
  // Find selected model
  const selectedModel = modelOptions.find(m => m.id === state.selections.model) || { name: "No model selected", price: 0 };
  
  // Create HTML for summary
  container.innerHTML = `
    <h2 class="text-lg font-semibold mb-4">Order Summary</h2>
    
    <div class="mb-6">
      <div id="snapshot-container" class="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
        <img id="snapshot-img" class="max-w-full max-h-full object-contain" alt="Configuration snapshot" />
        <div id="snapshot-placeholder" class="text-gray-400">Your configuration snapshot will appear here</div>
      </div>
      
      <div class="border rounded-lg p-4 bg-white">
        <h3 class="font-semibold mb-2">Selected Options</h3>
        
        <div class="mb-3">
          <div class="flex justify-between py-1 border-b">
            <span class="font-medium">Model</span>
            <span>${selectedModel.name}</span>
          </div>
          <div class="flex justify-between py-1 text-sm text-gray-600">
            <span>Base Price</span>
            <span>$${selectedModel.price.toLocaleString()}</span>
          </div>
        </div>
        
        ${Object.keys(state.selections.options).map(category => {
          const optionId = state.selections.options[category];
          if (!optionId) return '';
          
          const option = customizationOptions[category].find(o => o.id === optionId);
          if (!option) return '';
          
          return `
            <div class="mb-3">
              <div class="flex justify-between py-1 border-b">
                <span class="font-medium capitalize">${category}</span>
                <span>${option.name}</span>
              </div>
              ${option.price > 0 ? `
                <div class="flex justify-between py-1 text-sm text-gray-600">
                  <span>Additional Cost</span>
                  <span>+$${option.price.toLocaleString()}</span>
                </div>
              ` : ''}
            </div>
          `;
        }).join("")}
        
        <div class="mt-4 pt-2 border-t flex justify-between font-bold">
          <span>Total Price</span>
          <span>$${state.pricing.total.toLocaleString()}</span>
        </div>
      </div>
    </div>
    
    <div class="flex flex-col gap-3">
      <button id="capture-snapshot" class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition">
        Capture Snapshot
      </button>
      <button id="export-pdf" class="bg-blue-700 hover:bg-blue-800 text-white font-medium py-2 px-4 rounded transition">
        Export PDF
      </button>
      <button id="restart-config" class="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded transition mt-2">
        Start Over
      </button>
    </div>
  `;
  
  // Add event listeners
  document.getElementById("capture-snapshot").addEventListener("click", captureSnapshot);
  document.getElementById("export-pdf").addEventListener("click", exportPDF);
  document.getElementById("restart-config").addEventListener("click", restartConfiguration);
}

// Capture snapshot of the 3D viewer
function captureSnapshot() {
  const renderer = document.querySelector("#viewer-canvas canvas");
  if (!renderer) {
    showBanner("Unable to capture snapshot. Please try again.", "error");
    return;
  }
  
  try {
    const dataURL = renderer.toDataURL("image/png");
    const snapshotImg = document.getElementById("snapshot-img");
    const placeholder = document.getElementById("snapshot-placeholder");
    
    if (snapshotImg && placeholder) {
      snapshotImg.src = dataURL;
      snapshotImg.style.display = "block";
      placeholder.style.display = "none";
    }
    
    showBanner("Snapshot captured successfully!", "info", 3000);
  } catch (error) {
    console.error("Error capturing snapshot:", error);
    showBanner("Failed to capture snapshot. Please try again.", "error");
  }
}

// Export configuration as PDF
function exportPDF() {
  const { jsPDF } = window.jspdf;
  
  if (!jsPDF) {
    showBanner("PDF export library not loaded. Please try again later.", "error");
    return;
  }
  
  // Create a new PDF
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });
  
  // Add title
  pdf.setFontSize(20);
  pdf.text("WoodLab Configuration Summary", 20, 20);
  
  // Add date
  pdf.setFontSize(10);
  const today = new Date();
  pdf.text(`Generated on: ${today.toLocaleDateString()}`, 20, 30);
  
  // Add snapshot if available
  const snapshotImg = document.getElementById("snapshot-img");
  if (snapshotImg && snapshotImg.src && snapshotImg.style.display !== "none") {
    pdf.addImage(snapshotImg.src, "PNG", 20, 40, 170, 100);
  }
  
  // Add configuration details
  pdf.setFontSize(14);
  pdf.text("Selected Options", 20, 150);
  
  let yPos = 160;
  
  // Add model
  const selectedModel = modelOptions.find(m => m.id === state.selections.model);
  if (selectedModel) {
    pdf.setFontSize(12);
    pdf.text(`Model: ${selectedModel.name}`, 20, yPos);
    yPos += 7;
    pdf.setFontSize(10);
    pdf.text(`Base Price: $${selectedModel.price.toLocaleString()}`, 30, yPos);
    yPos += 12;
  }
  
  // Add options
  Object.keys(state.selections.options).forEach(category => {
    const optionId = state.selections.options[category];
    if (!optionId) return;
    
    const option = customizationOptions[category].find(o => o.id === optionId);
    if (!option) return;
    
    pdf.setFontSize(12);
    pdf.text(`${category.charAt(0).toUpperCase() + category.slice(1)}: ${option.name}`, 20, yPos);
    yPos += 7;
    
    if (option.price > 0) {
      pdf.setFontSize(10);
      pdf.text(`Additional Cost: +$${option.price.toLocaleString()}`, 30, yPos);
      yPos += 12;
    } else {
      yPos += 5;
    }
  });
  
  // Add total
  pdf.setFontSize(14);
  pdf.text(`Total Price: $${state.pricing.total.toLocaleString()}`, 20, yPos + 10);
  
  // Add footer
  pdf.setFontSize(8);
  pdf.text("WoodLab Furniture | www.woodlab.example.com | contact@woodlab.example.com | (555) 123-4567", 20, 280);
  
  // Save the PDF
  const filename = `WoodLab-Table-${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}-${today.getHours().toString().padStart(2, '0')}${today.getMinutes().toString().padStart(2, '0')}.pdf`;
  pdf.save(filename);
  
  // Show success banner
  showBanner("PDF exported successfully!", "info", 4000);
  
  // Dispatch exported event
  document.dispatchEvent(new Event("exported"));
}

// Restart configuration
function restartConfiguration() {
  setState({
    stage: 1,
    selections: { model: null, options: {} },
    pricing: { base: 12480, extras: 0, total: 12480 }
  });
  
  showBanner("Configuration restarted", "info", 3000);
}

// Price animation
function animatePrice(newTotal) {
  const priceBar = document.getElementById("price-bar");
  if (!priceBar) return;
  const oldTotal = parseFloat(priceBar.textContent.replace(/[^0-9.-]+/g,"")) || state.pricing.total;
  let start = null;
  const duration = 300;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    const currentPrice = Math.round(oldTotal + (newTotal - oldTotal) * progress);
    priceBar.innerHTML = `$${currentPrice.toLocaleString()} <span class="text-xs font-normal text-gray-500">USD</span>`;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Event listeners for navigation
document.addEventListener("DOMContentLoaded", () => {
  updateStageBar();
  updateSidebar();

  document.getElementById("prev-stage").addEventListener("click", () => {
    if (state.stage > 1) goToStage(state.stage - 1);
  });
  document.getElementById("next-stage").addEventListener("click", () => {
    // Validate before proceeding to next stage
    if (state.stage === 1 && !state.selections.model) {
      showBanner("Please select a model to continue", "warning");
      return;
    }
    
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
