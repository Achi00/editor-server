require("dotenv").config();
const mysql = require("mysql2/promise");

let pool;
(async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log("Connected to MySQL as app_user");

    // Execute a query to retrieve data
    const connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT * FROM users");
    // console.log("Users:", rows);

    // Close the connection
  } catch (error) {
    console.error("Error connecting to MySQL:", error);
  }
})();

module.exports = pool;
