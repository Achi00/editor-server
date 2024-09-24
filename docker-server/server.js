const express = require("express");
const ivm = require("isolated-vm");
const { JSDOM } = require("jsdom");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json()); // Expecting JSON payload with HTML and JS

// Route to execute jsdom code with dynamic HTML and JS
// app.post("/run", async (req, res) => {
//   const { html, jsCode, css } = req.body;

//   // Check if the code and HTML are strings
//   if (typeof html !== "string" || typeof jsCode !== "string") {
//     return res
//       .status(400)
//       .json({ error: "Invalid format, expected HTML and JS as strings." });
//   }

//   try {
//     // Create an isolated environment (sandbox)
//     const isolate = new ivm.Isolate({ memoryLimit: 8 });
//     const context = await isolate.createContext();

//     // Create jsdom environment with user-provided HTML
//     const dom = new JSDOM(html, {
//       runScripts: "dangerously",
//       resources: "usable",
//     });
//     const window = dom.window;

//     // Optionally inject CSS if provided
//     if (css) {
//       const style = window.document.createElement("style");
//       style.textContent = css;
//       window.document.head.appendChild(style);
//     }

//     // Inject the dom and window objects into the isolated-vm environment
//     await context.global.set("document", window.document, { copy: true });
//     await context.global.set("window", window, { copy: true });

//     // Ensure that jsCode is a string
//     if (typeof jsCode !== "string") {
//       throw new Error("jsCode must be a string.");
//     }

//     // Compile and run the user's JS code in the isolate
//     const script = await isolate.compileScript(jsCode); // This needs to be a string
//     await script.run(context);

//     // Return the updated DOM content (for example, the updated innerHTML of a specific element)
//     const result = window.document.getElementById("demo").innerHTML;

//     res.json({
//       output: result ? result : "Code executed successfully, no output",
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.toString() });
//   }
// });

app.post("/run", async (req, res) => {
  const { html, jsCode, css } = req.body;

  try {
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      resources: "usable",
    });

    // Optionally inject CSS
    if (css) {
      const style = dom.window.document.createElement("style");
      style.textContent = css;
      dom.window.document.head.appendChild(style);
    }

    // Execute the user's JS code
    dom.window.eval(jsCode);

    // Extract the result (modify as needed)
    const result = dom.window.document.getElementById("demo").innerHTML;

    res.json({
      output: result || "Code executed successfully, no output",
    });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

app.post("/runtest", async (req, res) => {
  res.json({
    output: "Code executed successfully",
  });
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Code execution server running on port ${PORT}`);
});
