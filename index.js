require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const installDependenciesRoute = require("./routes/installDependenciesRoute");
const runCodeRoute = require("./routes/runCodeRoute");
const createFileRoute = require("./routes/createFileRoute");
const needsDOMEnvironment = require("./helpers/checkJsDOM");
const loginRoutes = require("./routes/AuthRoute");
// const registrationRoute = require("./routes/AuthRoute");
// const tokenRoute = require("./routes/AuthRoute");

app.use(express.json());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/ifjsdom", (req, res) => {
  try {
    const { entryFile } = req.body;
    const data = needsDOMEnvironment(entryFile);
    res.json({ hasJsDom: data });
  } catch (error) {
    console.error("Error checking if JSDOM is needed:", error);
  }
});

// for file creatin & code execution
app.use("/v1/install", installDependenciesRoute);
app.use("/v1/run", runCodeRoute);
app.use("/v1/create-files", createFileRoute);

// for auth
app.use("/auth", loginRoutes);

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
