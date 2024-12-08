const express = require("express");
const app = express();
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const axios = require("axios");
const { createOrUpdatePackageJson } = require("../helpers/createJson");
// The container runs as root by default. For production, consider adding a non-root user in the Dockerfile.

// Helper function to get the project root directory
const getProjectRoot = () => {
  return path.resolve(__dirname, "..");
};

const runInDocker = (command, workDir) => {
  return new Promise((resolve, reject) => {
    const dockerCommand = `docker run --rm -v "${workDir}:/app" --user root nodejs-sandbox ${command}`;
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

router.post("/create-package", async (req, res) => {
  const { userId, packages } = req.body;
  const userFolder = userId
    ? `packages/${userId}`
    : `packages/${generateTempFolder()}`;

  // Ensure the folder exists
  if (!fs.existsSync(userFolder)) {
    fs.mkdirSync(userFolder, { recursive: true });
  }

  try {
    await createOrUpdatePackageJson(userFolder, userId, packages);
    res.status(200).json({
      status: "success",
      message: "package.json updated",
      userFolder: userFolder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
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

// get dependencies list from directory
router.post("/packagelist", (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    res.status(400).json({ Message: "userId is required" });
    return;
  }
  const projectRoot = getProjectRoot();
  let userFolder = userId
    ? `packages/${userId}`
    : `packages/${generateTempFolder()}`;
  let packageJson;
  let dependencies = [];

  fs.readFile(`${userFolder}/package.json`, "utf8", (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error reading package.json" });
    }

    try {
      packageJson = JSON.parse(data);
      const val = packageJson.dependencies;
      for (let key in val) {
        if (val.hasOwnProperty(key)) {
          dependencies.push({ name: key, version: val[key] });
        }
      }
      res.status(200).json({
        dependencies,
      });
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr);
      return res.status(500).json({ message: "Error parsing package.json" });
    }
  });
});

module.exports = router;
