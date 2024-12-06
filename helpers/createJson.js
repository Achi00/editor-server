const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Helper function to get package info from npm registry
const getPackageInfo = async (packageName) => {
  const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
  return response.data["dist-tags"].latest; // Get the latest version
};

async function createOrUpdatePackageJson(userFolder, userId, packages = []) {
  const packageJsonPath = path.join(userFolder, "package.json");
  let packageJson = {
    name: `temp-project-${userId}`,
    version: "1.0.0",
    description: "Temporary project for package management",
    private: true,
    dependencies: {
      jsdom: "^20.0.0",
    },
  };

  // If package.json exists, read it
  if (fs.existsSync(packageJsonPath)) {
    const existingPackageJson = fs.readFileSync(packageJsonPath, "utf8");
    packageJson = JSON.parse(existingPackageJson);
  }

  // If packages are provided, update dependencies
  if (Array.isArray(packages) && packages.length > 0) {
    for (const pkg of packages) {
      const latestVersion = await getPackageInfo(pkg);
      packageJson.dependencies[pkg] = `^${latestVersion}`;
    }
  }

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  return packageJson;
}

module.exports = {
  createOrUpdatePackageJson,
};
