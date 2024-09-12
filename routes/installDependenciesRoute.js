const express = require("express");
const app = express();
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
// The container runs as root by default. For production, consider adding a non-root user in the Dockerfile.

// Helper function to get the project root directory
const getProjectRoot = () => {
  return path.resolve(__dirname, "..");
};

const runInDocker = (command, workDir) => {
  return new Promise((resolve, reject) => {
    const dockerCommand = `docker run --rm -v "${workDir}:/app" nodejs-sandbox ${command}`;
    console.log(`Executing Docker command: ${dockerCommand}`);
    const childProcess = exec(
      dockerCommand,
      { timeout: 120000 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Docker command failed: ${error.message}`);
          reject(error);
        } else {
          console.log(`Docker command completed successfully`);
          resolve({ stdout, stderr });
        }
      }
    );

    childProcess.stdout.on("data", (data) => {
      console.log(`Docker stdout: ${data}`);
    });

    childProcess.stderr.on("data", (data) => {
      console.error(`Docker stderr: ${data}`);
    });
  });
};

// Generate a temporary session folder for unauthenticated users
const generateTempFolder = () => {
  return Math.random().toString(36).substring(2, 18);
};

// Helper function to get package info from npm registry
const getPackageInfo = async (packageName) => {
  const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
  return response.data["dist-tags"].latest; // Get the latest version
};

router.post("/create-package", async (req, res) => {
  const { userId, packages } = req.body;

  // Validate that 'packages' is an array
  if (!Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({
      status: "error",
      message: "Packages field must be a non-empty array.",
    });
  }

  let userFolder = userId
    ? `packages/${userId}`
    : `packages/${generateTempFolder()}`;

  // Ensure the folder exists
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  // Create the package.json file with basic metadata
  const packageJson = {
    name: `temp-project-${userId || generateTempFolder()}`, // Unique name
    version: "1.0.0",
    description: "Temporary project for package management",
    private: true, // Avoids accidental publishing to npm
    dependencies: {},
  };
  for (const pkg of packages) {
    const latestVersion = await getPackageInfo(pkg);
    packageJson.dependencies[pkg] = `^${latestVersion}`;
  }

  // Write package.json to user folder
  const packageJsonPath = path.join(userFolder, "package.json");
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  res.status(200).json({
    status: "success",
    message: "package.json created",
    userFolder: userFolder,
  });
});

router.post("/install", async (req, res) => {
  const { userId } = req.body;
  const projectRoot = getProjectRoot();
  const userFolder = path.join(
    projectRoot,
    "packages",
    userId || generateTempFolder()
  );

  // Create userFolder if it doesn't exist
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  // Check if package.json exists, if not, create a basic one
  const packageJsonPath = path.join(userFolder, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    const basicPackageJson = {
      name: "temp-project",
      version: "1.0.0",
      description: "Temporary project for code execution",
      private: true,
    };
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(basicPackageJson, null, 2)
    );
  }

  try {
    console.log(`Starting package installation for user: ${userId}`);
    const { stdout, stderr } = await runInDocker("npm install", userFolder);
    console.log(`Package installation completed. Sending response...`);
    res.status(200).json({
      status: "success",
      message: "Packages installed successfully",
      stdout,
      stderr,
      userFolder: userFolder,
    });
  } catch (error) {
    console.error(`Error during package installation: ${error.message}`);
    res.status(500).json({
      status: "error",
      message: "Failed to install packages",
      error: error.message,
    });
  }
});

module.exports = router;
