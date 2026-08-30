import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'data/viewer-models.json');
const inventoryPath = path.join(repoRoot, 'data/viewer-model-inventory.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function decodeAssetPath(assetPath) {
  return decodeURIComponent(assetPath);
}

function addAssetPath(paths, assetPath) {
  if (typeof assetPath === 'string' && assetPath.trim()) {
    paths.add(decodeAssetPath(assetPath.trim()));
  }
}

function collectManifestAssetPaths(manifest) {
  const paths = new Set();
  const defaults = manifest.defaults && typeof manifest.defaults === 'object'
    ? manifest.defaults
    : {};

  (defaults.parts || []).forEach((part) => {
    addAssetPath(paths, part.assetPath);
    Object.values(part.addonAssetPaths || {}).forEach((override) => {
      if (typeof override === 'string') {
        addAssetPath(paths, override);
        return;
      }
      if (override && typeof override === 'object') {
        addAssetPath(paths, override.assetPath);
        addAssetPath(paths, override.materialSourceAssetPath);
      }
    });
  });

  Object.values(defaults.legAssets || {}).forEach((definition) => {
    (definition.variants || []).forEach((variant) => addAssetPath(paths, variant.assetPath));
  });

  return paths;
}

function normalizeInventoryAssets(inventory, key) {
  return Array.isArray(inventory[key])
    ? inventory[key].filter((entry) => entry && typeof entry.assetPath === 'string')
    : [];
}

function assertAssetExists(assetPath, errors) {
  const localPath = path.join(repoRoot, assetPath);
  if (!fs.existsSync(localPath)) errors.push(`Missing asset file: ${assetPath}`);
}

function validateModelContract(manifest, errors) {
  const defaults = manifest.defaults && typeof manifest.defaults === 'object'
    ? manifest.defaults
    : {};
  const contract = defaults.modelContract && typeof defaults.modelContract === 'object'
    ? defaults.modelContract
    : null;
  if (!contract) {
    errors.push('Missing defaults.modelContract in data/viewer-models.json');
    return;
  }

  const sourceBounds = contract.sourceBounds && typeof contract.sourceBounds === 'object'
    ? contract.sourceBounds
    : {};
  ['length', 'width', 'height'].forEach((field) => {
    if (!Number.isFinite(Number(sourceBounds[field])) || Number(sourceBounds[field]) <= 0) {
      errors.push(`defaults.modelContract.sourceBounds.${field} must be a positive number`);
    }
  });

  const manifestPartNames = new Set((defaults.parts || [])
    .map((part) => part && part.name)
    .filter((name) => typeof name === 'string' && name.trim()));
  const partRoles = contract.partRoles && typeof contract.partRoles === 'object'
    ? contract.partRoles
    : {};
  Object.entries(partRoles).forEach(([roleName, roleConfig]) => {
    (roleConfig.requiredPartNames || []).forEach((partName) => {
      if (!manifestPartNames.has(partName)) {
        errors.push(`Contract role "${roleName}" requires missing manifest part "${partName}"`);
      }
    });
  });

  const edgeEditing = contract.edgeEditing && typeof contract.edgeEditing === 'object'
    ? contract.edgeEditing
    : {};
  const editablePartNames = Array.isArray(edgeEditing.editablePartNames)
    ? edgeEditing.editablePartNames
    : [];
  ['tabletop', 'tabletop-epoxy'].forEach((partName) => {
    if (!editablePartNames.includes(partName)) {
      errors.push(`Contract edgeEditing.editablePartNames should include "${partName}"`);
    }
  });
}

function main() {
  const manifest = readJson(manifestPath);
  const inventory = readJson(inventoryPath);
  const errors = [];
  const manifestAssets = collectManifestAssetPaths(manifest);
  const activeAssets = normalizeInventoryAssets(inventory, 'activeAssets');
  const runtimeCodeAssets = normalizeInventoryAssets(inventory, 'runtimeCodeAssets');
  const legacyCandidates = normalizeInventoryAssets(inventory, 'legacyCandidates');
  const activeInventoryPaths = new Set(activeAssets.map((entry) => entry.assetPath));

  manifestAssets.forEach((assetPath) => {
    assertAssetExists(assetPath, errors);
    if (!activeInventoryPaths.has(assetPath)) {
      errors.push(`Manifest asset is not listed in activeAssets: ${assetPath}`);
    }
  });

  activeAssets.forEach((entry) => {
    assertAssetExists(entry.assetPath, errors);
    if (!manifestAssets.has(entry.assetPath)) {
      errors.push(`activeAssets entry is not referenced by viewer-models.json: ${entry.assetPath}`);
    }
  });

  runtimeCodeAssets.forEach((entry) => assertAssetExists(entry.assetPath, errors));

  legacyCandidates.forEach((entry) => {
    assertAssetExists(entry.assetPath, errors);
    if (manifestAssets.has(entry.assetPath)) {
      errors.push(`legacyCandidates entry is still referenced by viewer-models.json: ${entry.assetPath}`);
    }
  });

  validateModelContract(manifest, errors);

  if (errors.length) {
    console.error('Viewer model validation failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Viewer model validation passed: ${manifestAssets.size} manifest assets, ${runtimeCodeAssets.length} runtime-code assets, ${legacyCandidates.length} legacy candidates.`);
}

main();
