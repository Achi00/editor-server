const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const pool = require("../db");

// Endpoint to create empty new file
router.post("/", async (req, res) => {
  const { userId, fileName, fileContent = "" } = req.body;

  // Validate input
  if (!userId || !fileName) {
    return res.status(400).json({ error: "userId and fileName are required" });
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

    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    if (fileExists) {
      return res
        .status(400)
        .json({ error: "File with this name already exists" });
    }

    await fs.writeFile(filePath, "");

    // Compute the relative path (to save in the database)
    const relativeFilePath = path.join("packages", userId, fileName);

    // Save file metadata in the database
    await pool.query(
      "INSERT INTO files (user_id, file_name, file_path) VALUES (?, ?, ?)",
      [userId, fileName, relativeFilePath]
    );
    // Return the list of files in the user's directory
    const files = await fs.readdir(userDir);

    res.status(200).json({
      message: "File created successfully",
      files: files,
      createdFile: { fileName, fileContent, relativeFilePath },
    });
  } catch (error) {
    console.error("Error creating file:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the file" });
  }
});

// update content
// insert content info file
router.put("/", async (req, res) => {
  const { userId, fileName, fileContent } = req.body;

  // Validate input
  if (!userId || !fileName || !fileContent) {
    return res
      .status(400)
      .json({ error: "userId, fileName, and fileContent are required" });
  }

  try {
    // check if file exists
    const [file] = await pool.query(
      "SELECT file_id, user_id FROM files WHERE user_id = ? AND file_name = ?",
      [userId, fileName]
    );

    if (file.length === 0) {
      // If no file is found, return 404
      return res.status(404).json({ error: "File not found" });
    } else if (userId != file[0].user_id) {
      return res
        .status(404)
        .json({ error: "You dont have access to modify this file" });
    }
    // Update the file content in the database
    const result = await pool.query(
      "UPDATE files SET file_content = ?, updated_at = NOW() WHERE user_id = ? AND file_name = ?",
      [fileContent, userId, fileName]
    );

    if (result.affectedRows == 0) {
      return res.status(404).json({ error: "File not found" });
    } else {
      // insert content info file
      // const userDir = path.join(__dirname,  "packages", userId);
      const filePath = path.join(__dirname, "..", "packages", userId, fileName);
      console.log(filePath);
      fs.writeFile(filePath, fileContent, "utf8", (err) => {
        if (err) {
          return console.error("Error writing file:", err);
        }

        console.log("Data inserted successfully!");
      });
      res.status(200).json({
        message: "File content saved successfully",
        fileName,
        fileContent,
      });
    }
  } catch (error) {
    console.error("Error saving file content:", error);
    res
      .status(500)
      .json({ error: "An error occurred while saving the file content" });
  }
});

// get list of files inside packages/userid
router.get("/list/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Path to the user's package directory
    const userDir = path.join(__dirname, "..", "packages", userId);

    // Check if the directory exists
    try {
      await fs.access(userDir);
    } catch (error) {
      return res.status(404).json({ error: "User directory not found", error });
    }

    // Read the contents of the directory
    const files = await fs.readdir(userDir);

    const filteredFiles = files.filter((file) => {
      return (
        (file.endsWith(".js") ||
          file.endsWith(".css") ||
          file.endsWith(".html")) &&
        file != "wrapped_index.js"
      );
    });

    res.status(200).json({
      message: "Files retrieved successfully",
      filteredFiles,
    });
  } catch (error) {
    console.error("Error retrieving files:", error);
    res.status(500).json({ error: "An error occurred while retrieving files" });
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

// Endpoint to retrieve file content from the database
router.get("/file-content/:userId/:fileName", async (req, res) => {
  const { userId, fileName } = req.params;

  try {
    // Query the database to get the file content
    const [file] = await pool.query(
      "SELECT file_content FROM files WHERE user_id = ? AND file_name = ?",
      [userId, fileName]
    );

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    console.log(file);

    res.status(200).json({
      fileName,
      fileContent: file,
    });
  } catch (error) {
    console.error("Error retrieving file content:", error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the file content" });
  }
});

module.exports = router;
