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

  const Id = String(userId);

  try {
    // Path to user's package directory
    const userDir = path.join(__dirname, "..", "packages", Id);

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
    const relativeFilePath = path.join("packages", Id, fileName);

    // Save file metadata in the database
    await pool.query(
      "INSERT INTO files (user_id, file_name, file_path) VALUES (?, ?, ?)",
      [Id, fileName, relativeFilePath]
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

// update & insert content info file
router.put("/", async (req, res) => {
  const { userId, files } = req.body;

  console.log(userId, files);

  // Validate input
  // files array should contain fileName and fileContent
  if (!userId || !files || !Array.isArray(files) || files.length === 0) {
    return res
      .status(400)
      .json({ error: "userId and an array of files are required" });
  }

  try {
    for (const file of files) {
      const { fileName, fileContent } = file;

      if (!fileName || !fileContent) {
        return res.status(400).json({
          error: "Each file object must have a fileName and fileContent",
        });
      }

      // Check if file exists in the database
      const [fileRecord] = await pool.query(
        "SELECT file_id, user_id FROM files WHERE user_id = ? AND file_name = ?",
        [userId, fileName]
      );

      if (fileRecord.length === 0) {
        // If no file is found, return 404
        return res.status(404).json({ error: `File '${fileName}' not found` });
      } else if (userId != fileRecord[0].user_id) {
        return res.status(403).json({
          error: `You don't have access to modify file '${fileName}'`,
        });
      }

      // Update the file content in the database
      const result = await pool.query(
        "UPDATE files SET file_content = ?, updated_at = NOW() WHERE user_id = ? AND file_name = ?",
        [fileContent, userId, fileName]
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ error: `File '${fileName}' not found during update` });
      }

      console.log(`updated ${file.fileName} in database`);

      // Update the actual file in the file system to execute code from there
      const filePath = path.join(__dirname, "..", "packages", userId, fileName);
      console.log(`Updating file at: ${filePath}`);

      try {
        await fs.writeFile(filePath, fileContent, "utf8");
        console.log(`File '${fileName}' updated successfully`);
      } catch (err) {
        console.error(`Error writing file '${fileName}':`, err);
        return res.status(500).json({
          error: `An error occurred while writing file '${fileName}'`,
        });
      }
    }

    // Respond with success after all files are processed
    res.status(200).json({
      message: "All files updated successfully",
    });
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
        file != "wrappedNodeCode.js" &&
        file != "wrappedCode.js"
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

// TODO: delete from database also
router.delete("/", async (req, res) => {
  let { userId, fileName } = req.body;

  // Validate input
  if (!userId || !fileName) {
    return res.status(400).json({ error: "userId and fileName are required" });
  }

  userId = String(userId);
  fileName = String(fileName);

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
    // delete from db
    await pool.query("DELETE FROM files WHERE user_id = ? AND file_name =?", [
      userId,
      fileName,
    ]);

    // Return the updated list of files in the user's directory after deletion
    const files = await fs.readdir(userDir);

    res.status(200).json({
      message: "File deleted successfully",
      files: files,
    });
    console.log("File deleted");
  } catch (error) {
    console.error("Error deleting file:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the file" });
  }
});

// Endpoint to retrieve file content from the database
router.post("/file-content/:userId", async (req, res) => {
  const { userId } = req.params;
  const { fileNames } = req.body;
  console.log(fileNames);

  try {
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return res.status(400).json({ error: "No file names provided" });
    }
    // Query the database to get the file content
    const [files] = await pool.query(
      "SELECT file_content FROM files WHERE user_id = ? AND file_name IN (?)",
      [userId, fileNames]
    );

    if (files.length === 0 || !files) {
      return res.status(404).json({ error: "Files not found" });
    }
    console.log(files);

    res.status(200).json({
      files: files.map((file) => ({
        fileName: file.file_name,
        fileContent: file.file_content,
      })),
    });
  } catch (error) {
    console.error("Error retrieving file content:", error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving the file content" });
  }
});

module.exports = router;
