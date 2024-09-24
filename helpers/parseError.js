function parseError(errorMessage) {
  // Split the error message into lines
  const errorLines = errorMessage.split("\n");

  // Find the first line that contains the actual error (e.g., ReferenceError)
  const relevantErrorLine = errorLines.find(
    (line) =>
      line.includes("ReferenceError") ||
      line.includes("TypeError") ||
      line.includes("SyntaxError")
  );

  // Return the first relevant error or fallback to the first line if none is found
  return relevantErrorLine || errorLines[0];
}

module.exports = parseError;
