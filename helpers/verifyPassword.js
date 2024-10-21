const bcrypt = require("bcrypt");
async function verifyPassword(enteredPassword, storedHashedPassword) {
  const isMatch = await bcrypt.compare(enteredPassword, storedHashedPassword);
  return isMatch;
}

module.exports = verifyPassword;
