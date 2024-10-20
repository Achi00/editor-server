function sanitizeModuleName(moduleName) {
  // Replace invalid characters while naming variable or import
  return moduleName.replace(/[^a-zA-Z0-9_$]/g, "_");
}

module.exports = sanitizeModuleName;
