const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs").promises;
const transporter = require("../helpers/mailer");
const path = require("path");
const pool = require("../db");

let refreshTokens = [];

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (rows.length > 0) {
      return res
        .status(400)
        .json({ message: "This email is already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Save user with email_verified = false
    await pool.query(
      "INSERT INTO users (name, email, password, email_verified, verification_token) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, false, verificationToken]
    );

    // Send verification email
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      message:
        "User registered successfully. \nTo finish registration please check your email to verify your account.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  try {
    // Corrected line: Use verification_token
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE verification_token = ?",
      [token]
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    const userId = rows[0].id;

    // Corrected line: Set verification_token to null after verification
    await pool.query(
      "UPDATE users SET email_verified = ?, verification_token = ? WHERE id = ?",
      [true, null, userId]
    );

    // Send the HTML file on success
    res.sendFile(path.join(__dirname, "../helpers/email.html"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (user.email_verified === 0) {
      return res
        .status(400)
        .json({ message: "Please verify your email before logging in" });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.REFRESH_TOKEN_SECRET
    );

    // Store refresh token in the users table
    await pool.query("UPDATE users SET refresh_token = ? WHERE id = ?", [
      refreshToken,
      user.id,
    ]);

    res.json({ accessToken, refreshToken, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  const { userId } = req.body;

  try {
    // Remove refresh token from users table
    await pool.query("UPDATE users SET refresh_token = NULL WHERE id = ?", [
      userId,
    ]);
    res.sendStatus(204);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

router.post("/token", async (req, res) => {
  const { userId } = req.body; // Or use email

  try {
    // Fetch the user and their refresh token from the database
    const [rows] = await pool.query(
      "SELECT refresh_token FROM users WHERE id = ?",
      [userId]
    );
    const user = rows[0];

    if (!user || !user.refresh_token) return res.sendStatus(403);

    const refreshToken = user.refresh_token;

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err) return res.sendStatus(403);

        const newAccessToken = jwt.sign(
          { id: userId, email: decoded.email },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "15m" }
        );
        res.json({ accessToken: newAccessToken });
      }
    );
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// reset password
// send email to user's mail
router.post("/reset-pass", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "email is required" });
  }
  try {
    // Check if user already exists
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (rows.length == 0) {
      return res.status(400).json({ message: "We cant find email" });
    } else {
      // send link to email
      await sendPasswordResetEmail(email);
      return res.status(200).json({
        message: "Check your email",
      });
    }
  } catch (error) {
    console.error(error.message);
  }
});
// change password if user succesfully fills reset password form
router.get("/reset-password", async (req, res) => {
  const { email } = req.query;

  try {
    // Corrected line: Use verification_token
    const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid user email" });
    }

    const userId = rows[0].id;

    // Corrected line: Set verification_token to null after verification
    await pool.query(
      "UPDATE users SET email_verified = ?, verification_token = ? WHERE id = ?",
      [true, null, userId]
    );

    // Send the HTML file on success
    res.sendFile(path.join(__dirname, "../helpers/email.html"));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

async function sendPasswordResetEmail(email) {
  const verificationLink = `http://localhost:8000/reset-password?email=${email}`;

  await transporter.sendMail({
    from: '"Code Runner" <no-reply@example.com>', // Sender address
    to: email, // Receiver's email
    subject: "Reset password",
    html: `<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">
          <tr>
              <td width="100%" style="background-color: #f8f8f8; padding: 20px; text-align: center;">
                  <img src="https://res.cloudinary.com/dle6xv667/image/upload/c_crop,w_1200,h_300/v1726253120/logo_ackzhq.png" alt="Company Logo" style="max-width: 150px;">
              </td>
          </tr>
          <tr>
              <td style="padding: 20px;">
                  <h1 style="color: #444; font-size: 24px;">Reset your account password</h1>
                  <p style="font-size: 16px;">To changing account password, click Reset password where you will be directed to form</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">
                      <tr>
                          <td>
                              <div style="text-align: center; margin: 30px 0;">
                                  
                         
             <a href="${verificationLink}" style="background-color: #D0FB51; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">Reset password</a>
                              </div>
                          </td>
                      </tr>
                  </table>
                  <p style="font-size: 14px;">If you didn't request password reset, please ignore this email or contact our support team if you have any questions.</p>
                  <p style="font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
              </td>
          </tr>
          <tr>
              <td style="background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                  <p>&copy; 2024 Code Runner</p>
                  <p>123 Main St, Anytown, ST 12345</p>
                  <p><a href="#" style="color: #007bff; text-decoration: none;">Privacy Policy</a> | <a href="#" style="color: #007bff; text-decoration: none;">Terms of Service</a></p>
              </td>
          </tr>
      </table>
  </body>
      
      `,
  });
}
async function sendVerificationEmail(email, token) {
  const verificationLink = `http://localhost:8000/verify-email?token=${token}`;

  await transporter.sendMail({
    from: '"Code Runner" <no-reply@example.com>', // Sender address
    to: email, // Receiver's email
    subject: "Email Verification",
    html: `<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">
          <tr>
              <td width="100%" style="background-color: #f8f8f8; padding: 20px; text-align: center;">
                  <img src="https://res.cloudinary.com/dle6xv667/image/upload/c_crop,w_1200,h_300/v1726253120/logo_ackzhq.png" alt="Company Logo" style="max-width: 150px;">
              </td>
          </tr>
          <tr>
              <td style="padding: 20px;">
                  <h1 style="color: #444; font-size: 24px;">Verify Your Email Address</h1>
                  <p style="font-size: 16px;">Thank you for signing up! Please click the button below to verify your email address and activate your account.</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">
                      <tr>
                          <td>
                              <div style="text-align: center; margin: 30px 0;">
                                  
                         
             <a href="${verificationLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">Verify Email</a>
                              </div>
                          </td>
                      </tr>
                  </table>
                  <p style="font-size: 14px;">If you didn't create an account with us, please ignore this email or contact our support team if you have any questions.</p>
                  <p style="font-size: 14px;">This link will expire in 24 hours for security reasons.</p>
              </td>
          </tr>
          <tr>
              <td style="background-color: #f8f8f8; padding: 20px; text-align: center; font-size: 12px; color: #666;">
                  <p>&copy; 2024 Code Runner</p>
                  <p>123 Main St, Anytown, ST 12345</p>
                  <p><a href="#" style="color: #007bff; text-decoration: none;">Privacy Policy</a> | <a href="#" style="color: #007bff; text-decoration: none;">Terms of Service</a></p>
              </td>
          </tr>
      </table>
  </body>
      
      `,
  });
}

module.exports = router;
