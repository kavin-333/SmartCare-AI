const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Patient = require("../models/Patient");

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "smartcare-development-secret";

// =====================================================
// PHONE NUMBER NORMALIZATION
// =====================================================

function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || "")
    .replace(/[\s()-]/g, "")
    .trim();
}

function isValidPhoneNumber(phoneNumber) {
  return /^\+[1-9]\d{7,14}$/.test(phoneNumber);
}

// =====================================================
// REGISTER
// =====================================================

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password || !phoneNumber) {
      return res.status(400).json({
        message: "Name, email, password and phone number are required",
      });
    }

    if (String(name).trim().length < 2) {
      return res.status(400).json({
        message: "Name must contain at least 2 characters",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (!isValidPhoneNumber(normalizedPhoneNumber)) {
      return res.status(400).json({
        message:
          "Please provide a valid phone number with country code. Example: +91 9876543210",
      });
    }

    const existingPatient = await Patient.findOne({
      email: normalizedEmail,
    });

    if (existingPatient) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const existingPhonePatient = await Patient.findOne({
      phoneNumber: normalizedPhoneNumber,
    });

    if (existingPhonePatient) {
      return res.status(409).json({
        message: "An account with this phone number already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const patient = await Patient.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phoneNumber: normalizedPhoneNumber,
    });

    return res.status(201).json({
      message: "Account created successfully",
      user: {
        id: patient._id.toString(),
        name: patient.name,
        email: patient.email,
        phoneNumber: patient.phoneNumber,
        created_at: patient.createdAt,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      if (duplicateField === "phoneNumber") {
        return res.status(409).json({
          message: "An account with this phone number already exists",
        });
      }

      if (duplicateField === "email") {
        return res.status(409).json({
          message: "An account with this email already exists",
        });
      }

      return res.status(409).json({
        message: "An account with these details already exists",
      });
    }

    return res.status(500).json({
      message: "Failed to create account",
    });
  }
});

// =====================================================
// LOGIN
// =====================================================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const patient = await Patient.findOne({
      email: normalizedEmail,
    });

    if (!patient) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      patient.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const user = {
      id: patient._id.toString(),
      name: patient.name,
      email: patient.email,
      phoneNumber: patient.phoneNumber || "",
    };

    const token = jwt.sign(user, JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Failed to login",
    });
  }
});

module.exports = router;
