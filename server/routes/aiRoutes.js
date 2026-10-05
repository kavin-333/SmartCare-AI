const express = require("express");

const {
  analyzeSymptoms,
} = require("../services/geminiService");

const Doctor = require("../models/Doctor");

const router = express.Router();

// ========================================
// SUPPORTED LANGUAGES
// ========================================

const supportedLanguages = [
  "en-IN",
  "ta-IN",
  "hi-IN",
  "te-IN",
  "ml-IN",
  "kn-IN",
];

// ========================================
// AI SPECIALTY → DATABASE SPECIALIZATION
// ========================================

const specialtyMapping = {
  // Cardiology
  cardiology: "Cardiologist",
  cardiologist: "Cardiologist",

  // Dermatology
  dermatology: "Dermatologist",
  dermatologist: "Dermatologist",
  "skin specialist": "Dermatologist",

  // General Medicine
  "general medicine": "General Physician",
  "general physician": "General Physician",
  physician: "General Physician",

  // Neurology
  neurology: "Neurologist",
  neurologist: "Neurologist",

  // Orthopedics
  orthopedics: "Orthopedist",
  orthopedic: "Orthopedist",
  orthopaedics: "Orthopedist",
  orthopaedic: "Orthopedist",
  orthopedist: "Orthopedist",

  // Pediatrics
  pediatrics: "Pediatrician",
  pediatric: "Pediatrician",
  pediatrician: "Pediatrician",
};

// ========================================
// NORMALIZE SPECIALTY
// ========================================

const normalizeSpecialty = (specialty) => {
  if (!specialty || typeof specialty !== "string") {
    return null;
  }

  const normalized = specialty
    .trim()
    .toLowerCase();

  return specialtyMapping[normalized] || null;
};

// ========================================
// AI SYMPTOM ANALYZER
// POST /api/ai/analyze-symptoms
// ========================================

router.post("/analyze-symptoms", async (req, res) => {
  try {
    const { symptoms, language } = req.body;

    // ========================================
    // VALIDATE SYMPTOMS
    // ========================================

    if (!symptoms || typeof symptoms !== "string") {
      return res.status(400).json({
        message: "Symptoms are required.",
      });
    }

    const cleanedSymptoms = symptoms.trim();

    if (!cleanedSymptoms) {
      return res.status(400).json({
        message: "Please describe your symptoms.",
      });
    }

    // ========================================
    // VALIDATE LANGUAGE
    // ========================================

    const selectedLanguage =
      supportedLanguages.includes(language)
        ? language
        : "en-IN";

    // ========================================
    // CALL GEMINI
    // ========================================

    const result = await analyzeSymptoms(
      cleanedSymptoms,
      selectedLanguage
    );

    // ========================================
    // USE INTERNAL SPECIALTY KEY
    // ========================================

    let databaseSpecialty = null;

    if (result.specialtyKey) {
      databaseSpecialty =
        normalizeSpecialty(result.specialtyKey);
    }

    // Fallback for English responses
    // in case specialtyKey is missing.
    if (!databaseSpecialty) {
      databaseSpecialty =
        normalizeSpecialty(result.specialty);
    }

    // Add database-compatible specialty
    result.databaseSpecialty =
      databaseSpecialty;

    // ========================================
    // RETURN AI RESULT
    // ========================================

    res.status(200).json(result);
  } catch (error) {
    console.error(
      "AI symptom analysis failed:",
      error.message
    );

    res.status(
      error.code === "GEMINI_API_KEY_MISSING" ? 503 : 500
    ).json({
      message:
        error.code === "GEMINI_API_KEY_MISSING"
          ? "AI symptom analysis is not configured on the server."
          : "Failed to analyze symptoms.",
    });
  }
});

// ========================================
// FIND DOCTORS BY SPECIALIZATION
// GET /api/ai/doctors/:specialty
// ========================================

router.get(
  "/doctors/:specialty",
  async (req, res) => {
    try {
      const specialty = decodeURIComponent(
        req.params.specialty
      ).trim();

      if (!specialty) {
        return res.status(400).json({
          message: "Specialty is required.",
        });
      }

      // ========================================
      // NORMALIZE SPECIALTY
      // ========================================

      const databaseSpecialty =
        normalizeSpecialty(specialty);

      if (!databaseSpecialty) {
        return res.status(400).json({
          message:
            "Unsupported medical specialty.",
          doctors: [],
        });
      }

      // ========================================
      // FIND DOCTORS
      // ========================================

      const doctors = await Doctor.find({
        specialization: databaseSpecialty,
      }).sort({
        rating: -1,
        experience: -1,
        name: 1,
      });

      // ========================================
      // NO DOCTORS FOUND
      // ========================================

      if (doctors.length === 0) {
        return res.status(404).json({
          message:
            `No doctors found for ${databaseSpecialty}.`,
          doctors: [],
        });
      }

      // ========================================
      // RETURN DOCTORS
      // ========================================

      res.status(200).json({
        specialty: databaseSpecialty,
        count: doctors.length,
        doctors,
      });
    } catch (error) {
      console.error(
        "Failed to find doctors:",
        error.message
      );

      res.status(500).json({
        message: "Failed to find doctors.",
      });
    }
  }
);

module.exports = router;
