const express = require("express");
const router = express.Router();

const Doctor = require("../models/Doctor");

// GET all doctors
router.get("/", async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .sort({
        rating: -1,
        experience: -1,
        name: 1,
      })
      .lean();

    const normalizedDoctors = doctors.map((doctor) => ({
      id: doctor._id,
      name: doctor.name,
      initials: doctor.initials || "",
      specialization: doctor.specialization,
      rating: doctor.rating,
      reviews: doctor.reviews,
      experience: doctor.experience,
      fee: doctor.fee,
      hospital: doctor.hospital,
    }));

    res.json(normalizedDoctors);
  } catch (error) {
    console.error("Fetch doctors error:", error);

    res.status(500).json({
      message: "Failed to fetch doctors.",
    });
  }
});

module.exports = router;