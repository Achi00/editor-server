const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const parseError = require("../helpers/parseError");
const {
  isContainerRunning,
  startDockerContainer,
  runUserCodeInDocker,
  runUserCodeInDockerNode,
} = require("../helpers/DockerRunners");
const isPortAvailable = require("../helpers/checkPort");
const { preprocessUserCode, loadModule } = require("../helpers/loadModule");
const sanitizeModuleName = require("../helpers/sanitizeModuleName");
const execPromise = util.promisify(exec);

router.get("/", async (req, res) => {
  res.status(200).send("hi");
});

router.post("/run-node", async (req, res) => {
  const { userId, entryFile } = req.body;

  if (!userId || !entryFile) {
    return res.status(400).json({ error: "userId and entryFile are required" });
  }
  // get uneque ports to avoid conflict
  const basePort = 3000;
  const containerPort = basePort + parseInt(userId);

  // check if port is avelable
  const portAvailable = await isPortAvailable(containerPort);
  if (!portAvailable) {
    return res
      .status(500)
      .json({ error: `Port ${containerPort} is already in use` });
  }

  try {
    // Path to user's package directory
    const userDir = path.resolve(__dirname, "..", "packages", userId);

    // Check if the container for the user is already running
    const containerExists = await isContainerRunning(userId);

    //Start the container if it doesn't already exist
    if (!containerExists) {
      await startDockerContainer(userId, userDir, containerPort);
    }

    // Check if the directory exists
    try {
      await fs.access(userDir);
    } catch (error) {
      return res.status(404).json({ error: "User directory not found" });
    }

    // Start the container
    await startDockerContainer(userId, userDir);

    // Read the user's JavaScript code (entryFile)
    const entryFilePath = path.join(userDir, entryFile);
    let userCodeContent = await fs.readFile(entryFilePath, "utf8");

    // Preprocess user code to extract modules and remove import/require statements
    const { userCodeContent: cleanCode, modulesToLoad } =
      preprocessUserCode(userCodeContent);

    // Dynamically load the extracted modules in the wrapper
    let loadModulesCode = "";
    for (const module of modulesToLoad) {
      const sanitizedModuleName = sanitizeModuleName(module.variableName); // Use variableName for the variable
      loadModulesCode += `
        const ${sanitizedModuleName} = await loadModule('${module.moduleName}'); // Use moduleName for loading the module
      `;
    }

    // Wrap the user's code if necessary
    if (!userCodeContent.trim().startsWith("module.exports")) {
      userCodeContent = `
        const loadModule = ${loadModule.toString()};
        module.exports = async function () {
        ${loadModulesCode}
        ${cleanCode}
        };
      `;
    }

    // Write the wrapped code to a temporary file
    const wrappedCodePath = path.join(userDir, "wrappedNodeCode.js");
    await fs.writeFile(wrappedCodePath, userCodeContent, "utf8");

    // Prepare the payload
    const codePayload = {
      jsFilePath: "wrappedNodeCode.js",
    };

    // Execute the user's code in Docker
    const { stdout, stderr, logs } = await runUserCodeInDockerNode(
      userId,
      codePayload
    );

    // Send the result back to the client
    res.json({
      output: stdout,
      logs: logs,
      error: stderr,
    });
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({
      error: "An error occurred while running the code",
      details: error.message,
      // logs: error.logs || "",
      output: "",
    });
  }
});
// run jsdom
router.post("/jsdom", async (req, res) => {
  // console.log("Request body:", req.body);
  const { userId, entryFile, htmlFile, cssFile } = req.body;

  if (!userId || !entryFile || !htmlFile) {
    return res
      .status(400)
      .json({ error: "userId, entryFile, and htmlFile are required" });
  }

  // get uneque ports to avoid conflict
  const basePort = 3000;
  const containerPort = basePort + parseInt(userId);

  // check if port is avelable
  const portAvailable = await isPortAvailable(containerPort);
  if (!portAvailable) {
    return res
      .status(500)
      .json({ error: `Port ${containerPort} is already in use` });
  }

  try {
    // Path to user's package directory
    const userDir = path.resolve(__dirname, "..", "packages", userId);

    // Check if the directory exists
    try {
      await fs.access(userDir);
    } catch (error) {
      return res.status(404).json({ error: "User directory not found" });
    }

    // Check if the container for the user is already running
    const containerExists = await isContainerRunning(userId);

    //Start the container if it doesn't already exist
    if (!containerExists) {
      await startDockerContainer(userId, userDir, containerPort);
    }

    // Read the HTML file
    const htmlFilePath = path.join(userDir, htmlFile);
    const htmlContent = await fs.readFile(htmlFilePath, "utf8");

    // Read the user's JavaScript code (entryFile)
    const entryFilePath = path.join(userDir, entryFile);
    let userCodeContent = await fs.readFile(entryFilePath, "utf8");

    // Preprocess user code to extract modules and remove import/require statements
    const { userCodeContent: cleanCode, modulesToLoad } =
      preprocessUserCode(userCodeContent);

    // Dynamically load the extracted modules in the wrapper with sanitized names
    let loadModulesCode = "";
    for (const { variableName, moduleName } of modulesToLoad) {
      loadModulesCode += `
        const ${variableName} = await loadModule('${moduleName}');
      `;
    }

    // wrap user code as function
    if (!userCodeContent.trim().startsWith("module.exports")) {
      userCodeContent = `
        const loadModule = ${loadModule.toString()};

        module.exports = async function (window, document) {
          ${loadModulesCode}
          ${cleanCode}
        };
      `;
    }
    // Write the wrapped code to a temporary file, to then pass conteiner server
    const wrappedCodePath = path.join(userDir, "wrappedCode.js");
    await fs.writeFile(wrappedCodePath, userCodeContent, "utf8");

    // Optional: Read the CSS file if provided
    let cssContent = "";
    if (cssFile) {
      const cssFilePath = path.join(userDir, cssFile);
      cssContent = await fs.readFile(cssFilePath, "utf8");
    }

    // Read the JavaScript file (entryFile)
    // const entryFilePath = path.join(userDir, entryFile);
    // const jsContent = await fs.readFile(entryFilePath, "utf8");

    // Split the code into components to pass as JSON
    const codePayload = {
      html: htmlContent,
      jsFilePath: "wrappedCode.js", // hard coded name of wrapped user code
      css: cssContent || "",
    };

    // Execute the user's code in Docker
    const { stdout, stderr, consoleLogs, finalHTML } =
      await runUserCodeInDocker(userId, codePayload, containerPort);

    // Send the result back to the client
    res.json({
      output: stdout,
      error: stderr,
      logs: consoleLogs,
      html: finalHTML,
    });
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({
      error: "An error occurred while running the code",
      // details: parseError(error.message),
      details: error.message,
    });
  }
});

module.exports = router;
