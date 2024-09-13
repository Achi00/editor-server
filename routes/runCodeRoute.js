const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

router.get("/", async (req, res) => {
  res.status(200).send("hi");
});

router.post("/", async (req, res) => {
  const { userId, code } = req.body;

  // Validate input
  if (!userId || !code) {
    return res.status(400).json({ error: "userId and code are required" });
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

    // Create a temporary file to store the user's code
    const tempFileName = `script_${userId}-${Date.now()}.js`;
    const tempFile = path.join(userDir, tempFileName);
    await fs.writeFile(tempFile, code);

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
      node ${tempFileName}`;

    console.log(`Executing Docker command: ${dockerCommand}`);

    const { stdout, stderr } = await execPromise(dockerCommand, {
      timeout: 10000,
    }); // 10 second timeout

    // Clean up the temporary file
    await fs.unlink(tempFile);

    res.json({
      output: stdout,
      error: stderr,
    });
  } catch (error) {
    console.error("Error running code:", error);
    res.status(500).json({ error: "An error occurred while running the code" });
  }
});

module.exports = router;
