// WoodLab Configurator - viewer.js
// Three.js 3D viewer setup
// NOTE: THREE.js is loaded globally from a CDN in index.html.
import { state } from './main.js'; // Import state from main.js

// TODO: Create SVG files for Model Two and Model Three in assets/images/

let renderer, scene, camera, controls, boxMesh;
let initialized = false;
let isLoading = false;

export function initViewer() {
  if (initialized) return;
  const container = document.getElementById("viewer-canvas");
  if (!container) return;

  // Show loading state
  showLoadingState(true);
  
  // Remove placeholder
  const placeholder = document.getElementById("viewer-placeholder");
  if (placeholder) placeholder.style.display = "none";

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8fafc);

  // Camera
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(2, 2, 3);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.5, 0);
  controls.update();

  // Placeholder model (BoxGeometry)
  boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.1, 1.5),
    new THREE.MeshStandardMaterial({ 
      color: 0x8B4513,
      roughness: 0.7,
      metalness: 0.1
    })
  );
  boxMesh.position.set(0, 0.05, 0);
  scene.add(boxMesh);
  
  // Add table legs
  addTableLegs();

  // Render loop
  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  // Hide loading state after a short delay to simulate loading
  setTimeout(() => {
    showLoadingState(false);
  }, 800);
  
  initialized = true;
}

// Add table legs
function addTableLegs() {
  const legMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    roughness: 0.7,
    metalness: 0.1
  });
  
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
    scene.add(leg);
  });
}

// Show/hide loading state
function showLoadingState(isLoading) {
  const container = document.getElementById("viewer-canvas");
  if (!container) return;
  
  // Create or get loading overlay
  let loadingOverlay = document.getElementById("loading-overlay");
  if (!loadingOverlay && isLoading) {
    loadingOverlay = document.createElement("div");
    loadingOverlay.id = "loading-overlay";
    loadingOverlay.className = "absolute inset-0 bg-gray-100 bg-opacity-80 flex flex-col items-center justify-center z-10";
    loadingOverlay.innerHTML = `
      <div class="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p class="text-gray-700">We're building your table...</p>
    `;
    container.appendChild(loadingOverlay);
  } else if (loadingOverlay && !isLoading) {
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
  if (!scene || !boxMesh) return;
  
  // Show loading state
  showLoadingState(true);
  
  // Remove existing table legs
  scene.children.forEach(child => {
    if (child !== boxMesh && child.type === "Mesh") {
      scene.remove(child);
    }
  });
  
  // Update model based on selection
  switch(modelId) {
    case "mdl-01": // Model One - Rectangular
      boxMesh.geometry = new THREE.BoxGeometry(1, 0.1, 1.5);
      boxMesh.position.set(0, 0.05, 0);
      addTableLegs();
      break;
    case "mdl-02": // Model Two - Round
      boxMesh.geometry = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32);
      boxMesh.position.set(0, 0.05, 0);
      // Add round table legs
      const roundLegMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.7,
        metalness: 0.1
      });
      
      // Create four legs for round table
      const roundLegPositions = [
        [-0.4, -0.4, 0.4], // front-left
        [0.4, -0.4, 0.4],  // front-right
        [-0.4, -0.4, -0.4], // back-left
        [0.4, -0.4, -0.4]   // back-right
      ];
      
      roundLegPositions.forEach(pos => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.8, 12),
          roundLegMaterial
        );
        leg.position.set(pos[0], pos[1], pos[2]);
        scene.add(leg);
      });
      break;
    case "mdl-03": // Model Three - Expandable
      boxMesh.geometry = new THREE.BoxGeometry(1.2, 0.1, 1.5);
      boxMesh.position.set(0, 0.05, 0);
      
      // Add expandable section
      const expandablePart = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 1.5),
        new THREE.MeshStandardMaterial({ 
          color: 0x8B4513,
          roughness: 0.7,
          metalness: 0.1
        })
      );
      expandablePart.position.set(-0.8, 0.05, 0);
      scene.add(expandablePart);
      
      // Add legs
      const expandableLegMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.7,
        metalness: 0.1
      });
      
      // Create six legs for expandable table
      const expandableLegPositions = [
        [-0.4, -0.4, 0.6], // main front-left
        [0.4, -0.4, 0.6],  // main front-right
        [-0.4, -0.4, -0.6], // main back-left
        [0.4, -0.4, -0.6],  // main back-right
        [-0.8, -0.4, 0.6],  // extension front
        [-0.8, -0.4, -0.6]  // extension back
      ];
      
      expandableLegPositions.forEach(pos => {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.8, 0.1),
          expandableLegMaterial
        );
        leg.position.set(pos[0], pos[1], pos[2]);
        scene.add(leg);
      });
      break;
    default:
      // Default rectangular table
      boxMesh.geometry = new THREE.BoxGeometry(1, 0.1, 1.5);
      boxMesh.position.set(0, 0.05, 0);
      addTableLegs();
  }
  
  // Hide loading state after a short delay
  setTimeout(() => {
    showLoadingState(false);
  }, 800);
}

// Bind reset button and listen for model changes
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("reset-view").addEventListener("click", resetView);
    
    // Initialize viewer
    initViewer();
    
    // Listen for model selection changes
    document.addEventListener("statechange", () => {
      if (state && state.selections && state.selections.model) {
        updateModel(state.selections.model);
      }
    });
  });
