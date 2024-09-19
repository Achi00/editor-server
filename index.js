const express = require("express");
const app = express();
const installDependenciesRoute = require("./routes/installDependenciesRoute");
const runCodeRoute = require("./routes/runCodeRoute");
const createFileRoute = require("./routes/createFileRoute");

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/v1/install", installDependenciesRoute);
app.use("/v1/run", runCodeRoute);
app.use("/v1/create-files", createFileRoute);

// Start the server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
