const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);
const axios = require("axios");

const startDockerContainer = async (userId, userDir) => {
  const containerName = `code-runner-${userId}`;

  try {
    // Check if the container is already running
    const containerExists = await execPromise(
      `docker ps --filter "name=${containerName}" --format "{{.Names}}"`
    );

    if (containerExists) {
      console.log(`Container ${containerName} is already running.`);
      return;
    }

    // Start a new Docker container if not running
    console.log(`Starting container: ${containerName}`);
    await execPromise(
      `docker run -d --name ${containerName} -p 3001:3000 -v "${userDir}:/app" -w /app code-runner-image`
    );
  } catch (error) {
    throw new Error(`Error creating Docker container: ${error.message}`);
  }
};

const runUserCodeInDocker = async (userId, code) => {
  const containerPort = 3001; // Assuming port 3000 is exposed for this user’s container

  const start = Date.now();
  try {
    console.log(`Sending code to the running Node.js server...`);

    // Send the user's code and HTML as a valid JSON object
    const payload = {
      html: code.html,
      jsCode: code.jsCode,
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

    console.error(`Error running code in Docker: ${error.message}`);
    return {
      stdout: "",
      stderr: error.response ? error.response.data.error : error.message,
    };
  }
};
// const runUserCodeInDocker = async (userId) => {
//   const containerName = `code-runner-${userId}`;
//   const dockerExecCommand = `docker exec ${containerName} node /app/wrapped_index.js`;

//   try {
//     console.log(`Try ro run code in container: ${containerName}`);
//     const { stdout, stderr } = await execPromise(dockerExecCommand);
//     console.log("Code execution completed successfully.");
//     return { stdout, stderr };
//   } catch (error) {
//     throw new Error(
//       `Error executing code in Docker container: ${error.message}`
//     );
//   }
// };

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
