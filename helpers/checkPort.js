// check avelable port to run docker container
const util = require("util");
const { exec } = require("child_process");
const execPromise = util.promisify(exec);

const isPortAvailable = async (port) => {
  try {
    await execPromise(`lsof -i:${port}`);
    // If no error, port is in use
    return false;
  } catch (error) {
    // If error, port is available
    return true;
  }
};

module.exports = isPortAvailable;
