const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const { parseError } = require("../helpers");
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
    const userDir = path.join(__dirname, "..", "packages", userId);

    // Check if the directory exists
    try {
      await fs.access(userDir);
    } catch (error) {
      return res.status(404).json({ error: "User directory not found" });
    }

    // Read the HTML file
    const htmlFilePath = path.join(userDir, htmlFile);
    const htmlContent = await fs.readFile(htmlFilePath, "utf8");

    // Optional: Read the CSS file if provided
    let cssContent = "";
    if (cssFile) {
      const cssFilePath = path.join(userDir, cssFile);
      cssContent = await fs.readFile(cssFilePath, "utf8");
    }

    // Read the JavaScript file (entryFile)
    const entryFilePath = path.join(userDir, entryFile);
    const jsContent = await fs.readFile(entryFilePath, "utf8");

    // Prepare the jsdom wrapper with HTML and optional CSS
    const jsdomHeader = `
      const { JSDOM } = require("jsdom");
      const dom = new JSDOM(\`${htmlContent}\`, { runScripts: "dangerously", resources: "usable" });
      const window = dom.window;
      const document = window.document;

      // Optionally inject CSS into the head
      if ('${cssContent}') {
        const style = document.createElement('style');
        style.textContent = \`${cssContent}\`;
        document.head.appendChild(style);
      }
    `;

    // Combine the jsdom setup with the user's JS code
    const wrappedCode = `${jsdomHeader}\n${jsContent}`;

    // Write the wrapped code to a temporary file
    const tempFilePath = path.join(userDir, "wrapped_index.js");
    await fs.writeFile(tempFilePath, wrappedCode);

    // Execute the user's code in Docker
    const containerName = `code-runner-${userId}-${Date.now()}`;
    const dockerCommand = `docker run --rm --name ${containerName} \
      -v "${userDir}:/app" \
      -w /app \
      node:18-slim \
      node wrapped_index.js`;

    console.log(`Executing Docker command: ${dockerCommand}`);

    // Run the command
    const { stdout, stderr } = await execPromise(dockerCommand, {
      timeout: 10000,
    });

    // Send the result back to the client
    res.json({
      output: stdout,
      error: parseError(stderr),
    });
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({
      error: "An error occurred while running the code",
      details: parseError(error.message),
    });
  }
});

module.exports = router;
