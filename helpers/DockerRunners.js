const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const axios = require("axios");

const startDockerContainer = async (userId, userDir) => {
  const containerName = `code-runner-${userId}`;

  try {
    // Check if the container is already running
    const { stdout } = await execPromise(
      `docker ps --filter "name=${containerName}" --format "{{.Names}}"`
    );

    if (stdout.trim() === containerName) {
      console.log(`Container ${containerName} is already running.`);
      return;
    }

    // Start a new Docker container if not running
    console.log(`Starting container: ${containerName}`);
    await execPromise(
      `docker run -d --name ${containerName} -p 3001:3000 -v "${userDir}:/app/user" -w /app --cpus 0.5 --memory 512m code-runner-image`
    );
  } catch (error) {
    throw new Error(`Error creating Docker container: ${error.message}`);
  }
};

const runUserCodeInDocker = async (userId, code) => {
  // const containerPort = 3000 + parseInt(userId);
  const containerPort = 3001;

  const start = Date.now();
  try {
    console.log(`Sending code to the running Node.js server...`);

    // Send the user's code and HTML as a valid JSON object
    const payload = {
      html: code.html,
      jsFilePath: code.jsFilePath,
      css: code.css,
    };

    // Send the user's code to the server inside Docker
    const response = await axios.post(
      `http://localhost:${containerPort}/run`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    const end = Date.now();
    console.log(`Code execution time: ${(end - start) / 1000} seconds`);

    return { stdout: response.data.output, stderr: "" };
  } catch (error) {
    const end = Date.now();
    console.log(
      `Code execution time (with error): ${(end - start) / 1000} seconds`
    );

    // Log detailed error information
    console.error("Error Object:", error);

    if (error instanceof AggregateError) {
      console.error("Multiple errors encountered:");
      error.errors.forEach((err, index) => {
        console.error(`Error ${index + 1}:`, err);
      });
    }

    if (error.response) {
      console.error("Error Response Status:", error.response.status);
      console.error("Error Response Data:", error.response.data);
    }

    console.error(`Error running code in Docker: ${error.message}`);
    return {
      stdout: "",
      stderr: error.response ? error.response.data.error : error.message,
    };
  }
};

const isContainerRunning = async (userId) => {
  console.log("checking if container running...");
  const containerName = `code-runner-${userId}`;
  const checkCommand = `docker ps --filter "name=${containerName}" --format "{{.Names}}"`;

  const { stdout } = await execPromise(checkCommand);
  return stdout.trim() === containerName;
};

module.exports = {
  startDockerContainer,
  runUserCodeInDocker,
  isContainerRunning,
};
