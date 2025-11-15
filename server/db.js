// ----------------------------------------------------
// Database Configuration: Smart Hostel Management System (SHMS)
// ----------------------------------------------------
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

let pool = null;
let ready = false;

// Load environment variables or fallback defaults
const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "smart_hostel";

// ----------------------------------------------------
// Initialize Database
// ----------------------------------------------------
async function init() {
  try {
    console.log("🔄 Initializing MySQL Database...");

    // Step 1: Connect temporarily (without DB) to create DB if missing
    const tempConn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    await tempConn.end();

    // Step 2: Create a pool connection to the database
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Step 3: Create tables if they don't exist
    await createTables();

    ready = true;
    console.log("✅ MySQL Database Initialized Successfully!");
  } catch (err) {
    console.error("❌ MySQL Initialization Failed:", err.message);
    ready = false;
  }
}

// ----------------------------------------------------
// Create Necessary Tables
// ----------------------------------------------------
async function createTables() {
  // Notices Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notices (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255),
      category VARCHAR(100),
      date DATE,
      content TEXT,
      archived TINYINT(1) DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Students Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255),
      room VARCHAR(50),
      email VARCHAR(255),
      phone VARCHAR(20)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Complaints Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS complaints (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      student_id BIGINT,
      category VARCHAR(100),
      details TEXT,
      status VARCHAR(50) DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Outpasses Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS outpasses (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      student_id BIGINT,
      from_date DATETIME,
      to_date DATETIME,
      reason TEXT,
      status VARCHAR(50) DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Visitors Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS visitors (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255),
      visitor_for VARCHAR(255),
      id_proof VARCHAR(255),
      phone VARCHAR(50),
      in_time DATETIME,
      out_time DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Rooms Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS rooms (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      number VARCHAR(50),
      capacity INT DEFAULT 1,
      occupancy INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Users Table (for login system)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role ENUM('admin','student','staff','security') DEFAULT 'student'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Feedbacks / Mess Ratings Table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      student_id BIGINT,
      mess VARCHAR(255),
      rating INT,
      comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log("📦 All tables verified or created.");
}

// ----------------------------------------------------
// Query Helper
// ----------------------------------------------------
async function query(sql, params = []) {
  if (!pool) throw new Error("❌ Database not initialized.");
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ----------------------------------------------------
// Exports
// ----------------------------------------------------
module.exports = {
  init,
  query,
  get ready() {
    return ready;
  },
};