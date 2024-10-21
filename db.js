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

    console.log(`Connected to MySQL as ${process.env.DB_USER}`);
  } catch (error) {
    console.error("Error connecting to MySQL:", error);
  }
})();

module.exports = {
  // Expose the pool directly to use pool.query() in your code
  query: async (sql, params) => {
    return pool.query(sql, params);
  },

  // Optional: If you want to keep the helper function
  executeQuery: async (query, params) => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(query, params);
      return rows;
    } finally {
      connection.release(); // Ensure connection is released back to the pool
    }
  },
};
