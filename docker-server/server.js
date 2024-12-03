const express = require("express");
const { JSDOM } = require("jsdom");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

// run jsdom code
app.post("/run", async (req, res) => {
  const { html, jsFilePath, css } = req.body;

  try {
    // Create jsdom environment
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      resources: "usable",
    });

    if (css) {
      const style = dom.window.document.createElement("style");
      style.textContent = css;
      dom.window.document.head.appendChild(style);
    }

    // Resolve the user's code file path
    const userCodePath = path.resolve("/app/user", jsFilePath);

    // Ensure the file exists
    if (!fs.existsSync(userCodePath)) {
      throw new Error(`User code file not found at ${userCodePath}`);
    }

    // Change working directory to /app/user
    process.chdir("/app/user");

    // clear cache to use new version of code
    delete require.cache[require.resolve(userCodePath)];

    // Load the user's code
    const userCode = require(userCodePath);

    console.log("user code: " + userCode);

    // Check if the user code exports a function
    if (typeof userCode !== "function") {
      throw new Error("User code must export a function");
    }

    // Capture console logs
    const consoleLogs = [];

    // Save original console methods
    const originalConsole = { ...console };

    // Override console methods
    console.log = (...args) => {
      consoleLogs.push(args.join(" "));
      originalConsole.log(...args);
    };
    console.error = (...args) => {
      consoleLogs.push(args.join(" "));
      originalConsole.error(...args);
    };

    // Execute the user's code, passing in the jsdom environment
    try {
      await userCode(dom.window, dom.window.document);
    } finally {
      // Restore original console methods
      console.log = originalConsole.log;
      console.error = originalConsole.error;
    }

    // Extract the result
    const result = dom.window.document.getElementById("demo").innerHTML;

    // Serialize the final HTML after code execution
    const finalHTML = dom.serialize();

    res.json({
      output: result || "Code executed successfully, no output",
      error: "",
      consoleLogs: consoleLogs,
      finalHTML: finalHTML,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

// run node js code
app.post("/run-node", async (req, res) => {
  const { jsFilePath } = req.body;

  let originalConsoleLog;
  let originalConsoleError;

  try {
    // Resolve the user's code file path
    const userCodePath = path.resolve("/app/user", jsFilePath);

    // Ensure the file exists
    if (!fs.existsSync(userCodePath)) {
      throw new Error(`User code file not found at ${userCodePath}`);
    }

    // Change working directory to /app/user
    process.chdir("/app/user");

    // Clear the module from the cache
    delete require.cache[require.resolve(userCodePath)];

    // Load the user's code
    const userCode = require(userCodePath);

    // Check if the user code exports a function
    if (typeof userCode !== "function") {
      throw new Error("User code must export a function");
    }

    // Capture console output
    const logs = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    console.log = function (...args) {
      logs.push(args.join(" "));
    };

    console.error = function (...args) {
      logs.push(args.join(" "));
    };

    // Execute the user's code
    await userCode();

    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Send response with logs
    res.json({
      output: logs.join("\n") || "Code executed successfully, no output",
      logs: logs.join("\n"),
      error: "",
    });
  } catch (err) {
    // Restore original console methods in case of error
    if (originalConsoleLog) console.log = originalConsoleLog;
    if (originalConsoleError) console.error = originalConsoleError;

    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});
app.get("/health", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Code execution server running on port ${PORT}`);
});
