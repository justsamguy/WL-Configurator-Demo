// WoodLab Configurator - viewer.js
// Three.js 3D viewer setup
// NOTE: THREE.js is loaded globally from a CDN in index.html.

let renderer, scene, camera, controls, boxMesh;
let initialized = false;

function initViewer() {
  if (initialized) return;
  const container = document.getElementById("viewer-canvas");
  if (!container) return;

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
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  boxMesh.position.set(0, 0.5, 0);
  scene.add(boxMesh);

  // Render loop
  function animate() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  initialized = true;
}

// Reset camera view
function resetView() {
  if (!controls || !camera) return;
  camera.position.set(2, 2, 3);
  controls.target.set(0, 0.5, 0);
  controls.update();
}

// Resize handler
function resizeViewer() {
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

// Bind reset button
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("reset-view").addEventListener("click", resetView);
  // Initialize viewer only if a model is selected (for now, always show placeholder)
  initViewer();
});

export { initViewer, resetView, resizeViewer };
