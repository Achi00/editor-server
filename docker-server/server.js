// server.js
const express = require("express");
const { JSDOM } = require("jsdom");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(bodyParser.json());

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

    console.log("jsFilePath: ", jsFilePath);
    console.log("userCodePath: ", userCodePath);

    // Ensure the file exists
    if (!fs.existsSync(userCodePath)) {
      throw new Error(`User code file not found at ${userCodePath}`);
    }

    // Change working directory to /app/user
    process.chdir("/app/user");

    // Load the user's code
    const userCode = require(userCodePath);

    console.log("user code: " + userCode);

    // Check if the user code exports a function
    if (typeof userCode !== "function") {
      throw new Error("User code must export a function");
    }

    // Execute the user's code, passing in the jsdom environment
    await userCode(dom.window, dom.window.document);

    // Extract the result
    const result = dom.window.document.getElementById("demo").innerHTML;

    res.json({
      output: result || "Code executed successfully, no output",
      error: "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Code execution server running on port ${PORT}`);
});
