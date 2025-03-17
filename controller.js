import { sql } from "./db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";

export const getUsers = async (req, res) => {
  try {
    const users = await sql`
            SELECT * FROM users
            ORDER BY created_at DESC
        `;
    console.log("fetched users: ", users);
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.log("Error in getUsers function", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const createUser = async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { first_name, last_name, email, password } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "All fields are required." });
  }

  // Hash the password before storing it
  const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

  try {
    const newUser = await sql`
        INSERT INTO users (first_name, last_name, email, password)
        VALUES (${first_name}, ${last_name}, ${email}, ${hashedPassword})
        RETURNING *
    `;

    console.log("new user added: ", newUser);
    res.status(201).json({ success: true, data: newUser[0] });
  } catch (error) {
    console.log("Error in createUser function", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const getUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await sql`
        SELECT * FROM users WHERE id=${id}
    `;

    if (user.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: user[0] });
  } catch (error) {
    console.log("Error in getUser function", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, password } = req.body;

  try {
    let hashedPassword = null;

    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const updatedUser = await sql`
        UPDATE users
        SET first_name=${first_name}, last_name=${last_name}, email=${email}, password=COALESCE(${hashedPassword}, password)
        WHERE id=${id}
        RETURNING *
    `;
    if (updatedUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: updatedUser[0] });
  } catch (error) {
    console.log("Error in updateUser function", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await sql`
        DELETE FROM users WHERE id=${id} RETURNING *
    `;

    if (deletedUser.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, data: deletedUser[0] });
  } catch (error) {
    console.log("Error in deleteUser function", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // ✅ Normalize email to lowercase before checking in DB
    const user =
      await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()} LIMIT 1;`;

    if (user.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }

    // ✅ Check if password matches
    const isMatch = await bcrypt.compare(password, user[0].password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }

    // ✅ Generate JWT Token
    const token = jwt.sign(
      {
        id: user[0].id,
        email: user[0].email,
        plan: user[0].plan,
        subscription_id: user[0].subscription_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log(user)

    // ✅ Send response with token & user data
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user[0].id,
        email: user[0].email,
        first_name: user[0].first_name,
        last_name: user[0].last_name,
        plan: user[0].plan,
      },
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const logoutUser = (req, res) => {
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ Extract user ID from token
    const user = await sql`SELECT id, first_name, last_name, email, plan, subscribed_at FROM users WHERE id = ${userId} LIMIT 1;`;

    if (!user.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, user: user[0] });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
