// Helper function to dynamically load both CommonJS and ESM modules
async function loadModule(moduleName) {
  if (typeof moduleName !== "string") {
    throw new Error(
      `Expected moduleName to be a string but got ${typeof moduleName}: ${moduleName}`
    );
  }
  let module;
  try {
    // Try to load as an ES module dynamically
    module = await import(moduleName);
    return module.default || module; // Handle default exports
  } catch (err) {
    if (err.code === "ERR_REQUIRE_ESM") {
      return import(moduleName);
    } else {
      return require(moduleName); // Fall back to CommonJS
    }
  }
}

// Function to preprocess user code: remove import/require and capture module names
// avoiding errors if npm packege needs require or import
function preprocessUserCode(userCodeContent) {
  const importPattern = /import\s+(\w+)\s+from\s+['"](.*)['"];?/g;
  const requirePattern = /const\s+(\w+)\s*=\s*require\(['"](.*)['"]\);?/g;

  let modulesToLoad = [];

  // Capture imports
  let match;
  // Capture imports and their variable names
  while ((match = importPattern.exec(userCodeContent)) !== null) {
    const variableName = match[1];
    const moduleName = match[2];
    modulesToLoad.push({ variableName, moduleName });
  }

  // Capture requires and their variable names
  while ((match = requirePattern.exec(userCodeContent)) !== null) {
    const variableName = match[1];
    const moduleName = match[2];
    modulesToLoad.push({ variableName, moduleName });
  }

  // Remove all import and require statements from user code
  userCodeContent = userCodeContent
    .replace(importPattern, "")
    .replace(requirePattern, "");

  return { userCodeContent, modulesToLoad };
}

module.exports = { loadModule, preprocessUserCode };
