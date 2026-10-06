const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const doctorRoutes = require("./routes/doctorRoutes");
const authRoutes = require("./routes/authRoutes");
const appointmentRoutes = require("./routes/appointmentRoutes");
const aiRoutes = require("./routes/aiRoutes");
const voiceRoutes = require("./routes/voiceRoutes");

const app = express();

const PORT = process.env.PORT || 8000;

// =====================================================
// BODY PARSERS
// =====================================================

// JSON requests from React/Postman
app.use(express.json());

// URL-encoded requests from Twilio webhooks
app.use(express.urlencoded({ extended: false }));

// =====================================================
// CORS
// =====================================================

app.use(
  cors({
    origin: (origin, callback) => {
      const configuredOrigins = (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((allowedOrigin) => allowedOrigin.trim())
        .filter(Boolean);

      // Allow requests with no origin (e.g. mobile apps, curl, Twilio webhooks)
      if (!origin) {
        return callback(null, true);
      }

      // If wildcard is configured
      if (configuredOrigins.includes("*")) {
        return callback(null, true);
      }

      // If specific origins are configured
      if (configuredOrigins.length > 0) {
        return callback(null, configuredOrigins.includes(origin));
      }

      // Default fallback: allow local development and Vercel domains
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:") ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }

      callback(null, true);
    },
    credentials: false,
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// =====================================================
// MONGODB CONNECTION & SERVERLESS SETUP
// =====================================================

let isConnected = false;
let lastDbError = null;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState >= 1) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    lastDbError = "MONGODB_URI is not set in environment variables";
    console.warn(lastDbError);
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    lastDbError = null;
    console.log("MongoDB connected successfully.");
  } catch (error) {
    lastDbError = error.message;
    console.error("MongoDB connection failed:", error);
  }
};

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/", async (req, res) => {
  await connectDB();
  const isDbReady = mongoose.connection.readyState === 1;
  res.json({
    message: "SmartCare backend is running",
    port: PORT,
    database: isDbReady ? "connected" : "disconnected",
    dbName: mongoose.connection.name,
    ...(isDbReady ? {} : { dbError: lastDbError }),
  });
});

app.get("/api", async (req, res) => {
  await connectDB();
  const isDbReady = mongoose.connection.readyState === 1;
  res.json({
    message: "SmartCare API is running",
    database: isDbReady ? "connected" : "disconnected",
    ...(isDbReady ? {} : { dbError: lastDbError }),
  });
});

// Middleware to ensure DB is connected before processing requests
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// =====================================================
// ROUTES
// =====================================================

app.use("/api/auth", authRoutes);

app.use(
  "/api/appointments",
  appointmentRoutes
);

app.use("/api/ai", aiRoutes);

app.use("/api/voice", voiceRoutes);

app.use("/api/doctors", doctorRoutes);

// Only start the HTTP listener when running standalone (e.g. locally)
if (!process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(
        `SmartCare backend running on http://localhost:${PORT}`
      );
    });
  });
}

module.exports = app;
