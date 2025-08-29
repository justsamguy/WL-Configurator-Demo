// WoodLab Configurator - viewer.js
// Three.js 3D viewer setup
// NOTE: THREE.js is loaded globally from a CDN in index.html.
import { state } from './main.js'; // Import state from main.js

let renderer, scene, camera, controls;
let initialized = false;
let isLoading = false;
let currentPlaceholderImage = null; // To keep track of the current placeholder image

// Function to display SVG placeholder image
function displayPlaceholderImage(modelId) {
  const container = document.getElementById("viewer-canvas");
  if (!container) return;

  // Hide Three.js canvas if it exists
  if (renderer && renderer.domElement) {
    renderer.domElement.style.display = "none";
  }

  let placeholderDiv = document.getElementById("viewer-placeholder");
  if (!placeholderDiv) {
    placeholderDiv = document.createElement("div");
    placeholderDiv.id = "viewer-placeholder";
    placeholderDiv.className = "text-center text-gray-400 text-lg flex flex-col items-center justify-center w-full h-full";
    container.appendChild(placeholderDiv);
  } else {
    placeholderDiv.style.display = "flex"; // Ensure it's visible
  }

  // Prefer model SVGs if present, otherwise fall back to the WoodLab brand placeholder
  const svgPath = `assets/images/${modelId}.svg`;
  const fallbackBrand = `assets/Brand/WoodLab_official_-_for_blackwhite_print.png`;
  const imagePath = svgPath; // default to model SVG
  // Check if the image already exists and is the correct one
  if (currentPlaceholderImage && currentPlaceholderImage.src.includes(imagePath)) {
    return; // Image is already displayed
  }

  // Clear previous image
  placeholderDiv.innerHTML = '';

  const img = document.createElement("img");
  img.src = imagePath;
  img.alt = `Placeholder for ${modelId}`;
  img.className = "max-w-full max-h-full object-contain viewer-placeholder-img"; // Ensure image scales within container
  // If the requested SVG fails to load, swap to the brand fallback
  img.onerror = () => { img.src = fallbackBrand; img.classList.add('brand-fallback'); };
  placeholderDiv.appendChild(img);

  const label = document.createElement("p");
  label.className = "mt-4 text-gray-600 font-semibold text-xl";
  label.textContent = `Model: ${modelId.replace('model', 'Model ')}`; // e.g., "Model: Model 1"
  placeholderDiv.appendChild(label);

  currentPlaceholderImage = img;
}

// Function to hide placeholder image and show Three.js canvas
function hidePlaceholderImage() {
  const placeholderDiv = document.getElementById("viewer-placeholder");
  if (placeholderDiv) {
    placeholderDiv.style.display = "none";
  }
  if (renderer && renderer.domElement) {
    renderer.domElement.style.display = "block";
  }
  currentPlaceholderImage = null;
}

// Enhance lighting for better visualization
function enhanceLighting() {
  // Remove existing lights
  scene.children.forEach(child => {
    if (child.type === "AmbientLight" || child.type === "DirectionalLight") {
      scene.remove(child);
    }
  });
  
  // Add improved lighting setup
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  
  const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
  mainLight.position.set(5, 10, 7);
  mainLight.castShadow = true;
  scene.add(mainLight);
  
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-5, 5, -7);
  scene.add(fillLight);
  
  const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
  backLight.position.set(0, 5, -10);
  scene.add(backLight);
}

// Add a subtle ground plane for better spatial context
function addGroundPlane() {
  const groundGeometry = new THREE.PlaneGeometry(20, 20);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xf5f5f5,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = Math.PI / 2;
  ground.position.y = -0.8;
  ground.receiveShadow = true;
  scene.add(ground);
}

// Improve material quality
function createEnhancedMaterials() {
  return {
    tableMaterial: new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.7,
      metalness: 0.1,
      envMapIntensity: 1.0
    }),
    legMaterial: new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.7,
      metalness: 0.1,
      envMapIntensity: 1.0
    })
  };
}

export function initViewer() {
  if (initialized) return;
  const container = document.getElementById("viewer-canvas");
  if (!container) {
    console.warn("Viewer canvas container not found. Viewer initialization deferred.");
    return;
  }

  // Initially display a placeholder image
  displayPlaceholderImage("model1"); // Display model1 as default placeholder

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafc);
  // The Three.js scene will be hidden by default until a model is loaded
  if (renderer && renderer.domElement) {
    renderer.domElement.style.display = "none";
  }

  // Camera
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(2, 2, 3);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Enhanced lighting
  enhanceLighting();
  
  // Add ground plane
  addGroundPlane();

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.5, 0);
  controls.update();

  // Render loop
  function animate() {
    if (renderer && scene && camera) { // Only render if Three.js is active
      controls.update();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }
  animate();
  
  initialized = true;
}

// Update the addTableLegs function to use the enhanced material
// This function will only be called if actual 3D models are loaded, not for placeholders
function addTableLegs(legMaterial) {
  // Create four legs
  const legPositions = [
    [-0.4, -0.4, 0.6], // front-left
    [0.4, -0.4, 0.6],  // front-right
    [-0.4, -0.4, -0.6], // back-left
    [0.4, -0.4, -0.6]   // back-right
  ];
  
  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.8, 0.1),
      legMaterial
    );
    leg.position.set(pos[0], pos[1], pos[2]);
    leg.castShadow = true;
    leg.receiveShadow = true;
    scene.add(leg);
  });
}

// Show loading state
function showLoadingState() {
  const container = document.getElementById("viewer-canvas");
  if (!container) return;
  
  // Create or get loading overlay
  let loadingOverlay = document.getElementById("loading-overlay");
  if (!loadingOverlay) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loading-overlay";
    loadingOverlay.className = "absolute inset-0 bg-gray-100 bg-opacity-80 flex flex-col items-center justify-center z-10";
    loadingOverlay.innerHTML = `
      <div class="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-gray-700">We're building your table...</p>
    `;
    container.appendChild(loadingOverlay);
  }
  loadingOverlay.classList.remove("opacity-0");
}

// Hide loading state
function hideLoadingState() {
  const loadingOverlay = document.getElementById("loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.classList.add("opacity-0");
    setTimeout(() => {
      if (loadingOverlay.parentNode) {
        loadingOverlay.parentNode.removeChild(loadingOverlay);
      }
    }, 300);
  }
}

// Reset camera view
export function resetView() {
  if (!controls || !camera) return;
  camera.position.set(2, 2, 3);
  controls.target.set(0, 0.5, 0);
  controls.update();
}

// Resize handler
export function resizeViewer() {
  if (!renderer || !camera) return;
  const container = document.getElementById("viewer-canvas");
  if (!container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

// Debounced resize
let resizeTimeout = null;
window.addEventListener("resize", () => {
  if (resizeTimeout) clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(resizeViewer, 200);
});

// Update model based on selection
export function updateModel(modelId) {
  // For now, we only display placeholder images.
  // In a real scenario, this function would load and display the actual 3D model.
  hideLoadingState(); // Ensure loading state is hidden
  displayPlaceholderImage(modelId);
}

// Function to initialize viewer controls after they are loaded into the DOM
export function initViewerControls() {
  const resetViewButton = document.getElementById("reset-view");
  if (resetViewButton) {
    resetViewButton.addEventListener("click", resetView);
  } else {
    console.warn("Reset view button not found. Viewer controls might not be loaded yet.");
  }
}

// Listen for model selection changes
document.addEventListener("statechange", () => {
  if (state && state.selections && state.selections.model) {
    updateModel(state.selections.model);
  }
});
