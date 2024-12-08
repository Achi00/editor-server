const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const axios = require("axios");
const path = require("path");

// check if docker container has started to avoid getting
const waitForServer = async (port, timeout = 10000, interval = 500) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      await axios.get(`http://localhost:${port}/health`);
      // Server is ready
      return;
    } catch (err) {
      // Connection failed, server is not ready yet
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw new Error(`Server did not become ready within ${timeout} ms`);
};

const startDockerContainer = async (userId, userDir, containerPort) => {
  const containerName = `code-runner-${userId}`;

  try {
    const absoluteUserDir = path.resolve(userDir);

    // Check if the container exists (running or stopped)
    const { stdout } = await execPromise(
      `docker ps -a --filter "name=${containerName}" --format "{{.Names}}"`
    );

    if (stdout.trim() === containerName) {
      console.log(`Container ${containerName} already exists.`);
      // Check if the container is running
      const { stdout: runningContainer } = await execPromise(
        `docker ps --filter "name=${containerName}" --format "{{.Names}}"`
      );
      // is running, dont run
      if (runningContainer.trim() === containerName) {
        console.log(`Container ${containerName} is already running.`);
        return;
      } else {
        // Container exists but is not running, start it
        console.log(`Starting existing container ${containerName}.`);
        await execPromise(`docker start ${containerName}`);
        // Wait for the server to be ready
        await waitForServer(containerPort);
        return;
      }
    } else {
      // Container does not exist, create and start it
      console.log(`Starting new container: ${containerName}`);
      const dockerCommand = `docker run --user root -d --name ${containerName} -p ${containerPort}:3000 -v "${absoluteUserDir}:/app/user" -w /app --cpus 0.5 --memory 512m code-runner-image`;
      console.log(`Docker command: ${dockerCommand}`);
      await execPromise(dockerCommand);
      // Wait for the server to be ready
      await waitForServer(containerPort);
    }
  } catch (error) {
    throw new Error(`Error creating Docker container: ${error.message}`);
  }
};

// run user jsdom code
const runUserCodeInDocker = async (userId, code, containerPort) => {
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

    const time = end - start;

    const data = response.data;

    return {
      stdout: response.data.output,
      stderr: "",
      consoleLogs: data.consoleLogs || [],
      finalHTML: data.finalHTML || [],
      time: time,
    };
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

// run user's node js code
const runUserCodeInDockerNode = async (userId, code) => {
  const hostPort = 3000 + parseInt(userId); // Unique port per user

  try {
    const start = Date.now();
    // Wait for the server to be ready
    await waitForServer(hostPort);

    console.log(
      `Sending code to the running Node.js server on port ${hostPort}...`
    );

    // Send the user's code to the server inside Docker
    const response = await axios.post(
      `http://localhost:${hostPort}/run-node`,
      code,
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("Docker response:", response);
    const end = Date.now();
    console.log(`Code execution time: ${(end - start) / 1000} seconds`);

    const time = end - start;

    return {
      stdout: response.data.output,
      logs: response.data.logs,
      stderr: response.data.error || "",
      time: time,
    };
  } catch (error) {
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
  runUserCodeInDockerNode,
};
