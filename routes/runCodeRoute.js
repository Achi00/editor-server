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
} = require("../helpers/DockerRunners");
const execPromise = util.promisify(exec);

router.get("/", async (req, res) => {
  res.status(200).send("hi");
});

router.post("/", async (req, res) => {
  const { userId, entryFile } = req.body;

  // Validate input
  if (!userId || !entryFile) {
    return res
      .status(400)
      .json({ error: "userId and entryFiles are required" });
  }

  try {
    // Path to user's package directory
    const userDir = path.join(__dirname, "..", "packages", userId);

    // Check if the directory exists
    try {
      await fs.access(userDir);
    } catch (error) {
      return res.status(404).json({ error: "User directory not found" });
    }

    // Ensure entry file exists
    const entryFilePath = path.join(userDir, entryFile);
    try {
      await fs.access(entryFilePath);
    } catch (error) {
      return res.status(404).json({ error: "Entry file not found" });
    }

    // Run the code in a Docker container
    const containerName = `code-runner-${userId}-${Date.now()}`;
    const dockerCommand = `docker run --rm --name ${containerName} \
      -v "${userDir}:/app" \
      -w /app \
      --cpus 0.2 \
      --memory 256m \
      --read-only \
      --tmpfs /tmp:rw,noexec,nosuid \
      node:18-slim \
      node ${entryFile}`;

    console.log(`Executing Docker command: ${dockerCommand}`);

    const { stdout, stderr } = await execPromise(dockerCommand, {
      timeout: 10000,
    }); // 10 second timeout

    // Clean up the temporary file
    // await fs.unlink(tempFile);

    res.json({
      output: stdout,
      error: stderr,
    });
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({ error: "An error occurred while running the code" });
  }
});

// run jsdom
router.post("/jsdom", async (req, res) => {
  const { userId, entryFile, htmlFile, cssFile } = req.body;

  if (!userId || !entryFile || !htmlFile) {
    return res
      .status(400)
      .json({ error: "userId, entryFile, and htmlFile are required" });
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

    const containerPort = 3001;

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

    // wrap user code as function
    if (!userCodeContent.trim().startsWith("module.exports")) {
      userCodeContent = `
    module.exports = async function (window, document) {
      ${userCodeContent}
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
    const { stdout, stderr, consoleLogs } = await runUserCodeInDocker(
      userId,
      codePayload
    );

    // Send the result back to the client
    res.json({
      output: stdout,
      error: stderr,
      logs: consoleLogs,
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
