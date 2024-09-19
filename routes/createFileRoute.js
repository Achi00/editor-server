const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");

// Endpoint to create a new file
router.post("/", async (req, res) => {
  const { userId, fileName, fileContent } = req.body;

  // Validate input
  if (!userId || !fileName || fileContent === undefined) {
    return res
      .status(400)
      .json({ error: "userId, fileName, and fileContent are required" });
  }

  try {
    // Path to user's package directory
    const userDir = path.join(__dirname, "..", "packages", userId);

    // Create user directory if it doesn't exist
    try {
      await fs.access(userDir);
    } catch (error) {
      await fs.mkdir(userDir, { recursive: true });
      console.error(error);
    }

    // Create or overwrite the file with the given content
    const filePath = path.join(userDir, fileName);

    // Check if the file already exists
    try {
      await fs.access(filePath); // Will throw an error if the file doesn't exist
      console.log("File already exists");
      return res
        .status(400)
        .json({ error: "File with this name already exists" });
    } catch (error) {
      // File does not exist, we can proceed to create it
    }

    await fs.writeFile(filePath, fileContent);

    // Return the list of files in the user's directory
    const files = await fs.readdir(userDir);

    res.status(200).json({
      message: "File created successfully",
      files: files,
      createdFile: { fileName, fileContent },
    });
  } catch (error) {
    console.error("Error creating file:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the file" });
  }
});

router.delete("/", async (req, res) => {
  const { userId, fileName } = req.body;

  // Validate input
  if (!userId || !fileName) {
    return res.status(400).json({ error: "userId and fileName are required" });
  }

  try {
    // Path to user's package directory
    const userDir = path.join(__dirname, "..", "packages", userId);

    // Path to the file that should be deleted
    const filePath = path.join(userDir, fileName);

    // Check if the file exists before attempting to delete it
    try {
      await fs.access(filePath); // Will throw an error if the file doesn't exist
    } catch (error) {
      return res.status(404).json({ error: "File not found" });
    }

    // Delete the file
    await fs.unlink(filePath);

    // Return the updated list of files in the user's directory after deletion
    const files = await fs.readdir(userDir);

    res.status(200).json({
      message: "File deleted successfully",
      files: files,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the file" });
  }
});

module.exports = router;
