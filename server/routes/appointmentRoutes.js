const express = require("express");
const mongoose = require("mongoose");

const authenticateToken = require("../middleware/authMiddleware");

const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

const router = express.Router();

// =====================================================
// AVAILABLE TIME SLOTS
// =====================================================

const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
];

// =====================================================
// GET AVAILABLE TIME SLOTS
// GET /api/appointments/availability/:doctorId?date=YYYY-MM-DD
// =====================================================

router.get("/availability/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        message: "Invalid doctor ID",
      });
    }

    if (!date) {
      return res.status(400).json({
        message: "Appointment date is required",
      });
    }

    // Find doctor
    const doctor = await Doctor.findById(doctorId).select(
      "name"
    );

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    // Find already booked appointments
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: date,
      status: { $ne: "Cancelled" },
    }).select("appointmentTime");

    const bookedSlots = bookedAppointments.map(
      (appointment) => appointment.appointmentTime
    );

    // Remove booked slots
    const availableSlots = TIME_SLOTS.filter(
      (slot) => !bookedSlots.includes(slot)
    );

    return res.json({
      doctorId,
      doctorName: doctor.name,
      date,
      availableSlots,
    });
  } catch (error) {
    console.error(
      "Availability error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch availability",
    });
  }
});

// =====================================================
// GET APPOINTMENTS FOR LOGGED-IN PATIENT
// GET /api/appointments
// =====================================================

router.get("/", authenticateToken, async (req, res) => {
  try {
    const patientId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(401).json({
        message: "Invalid patient authentication",
      });
    }

    const appointments = await Appointment.find({
      patient: patientId,
    })
      .populate(
        "doctor",
        "name specialization hospital rating reviews experience fee initials"
      )
      .populate(
        "patient",
        "name email"
      )
      .sort({
        appointmentDate: 1,
        appointmentTime: 1,
      });

    const result = appointments.map((appointment) => ({
      id: appointment._id,
      patient_id: appointment.patient?._id,
      patient_name: appointment.patient?.name,
      patient_email: appointment.patient?.email,
      doctor_id: appointment.doctor?._id,
      doctor_name: appointment.doctor?.name,
      specialization: appointment.doctor?.specialization,
      appointment_date:
        appointment.appointmentDate,
      appointment_time:
        appointment.appointmentTime,
      phone_number: appointment.phoneNumber,
      status: appointment.status,
    }));

    return res.json(result);
  } catch (error) {
    console.error(
      "Get appointments error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch appointments",
    });
  }
});

// =====================================================
// CREATE APPOINTMENT
// POST /api/appointments
// =====================================================

router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
  doctor_id,
  appointment_date,
  appointment_time,
  phone_number,
} = req.body;

    const patientId = req.user.id;

    // Validate input
    if (
  !doctor_id ||
  !appointment_date ||
  !appointment_time ||
  !phone_number
) {
  return res.status(400).json({
    message:
      "doctor_id, appointment_date, appointment_time and phone_number are required",
  });
}
// Validate phone number
const normalizedPhoneNumber = phone_number
  .replace(/[\s()-]/g, "");

if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhoneNumber)) {
  return res.status(400).json({
    message:
      "Please provide a valid phone number with country code.",
  });
}

    // Validate doctor ObjectId
    if (!mongoose.Types.ObjectId.isValid(doctor_id)) {
      return res.status(400).json({
        message: "Invalid doctor ID",
      });
    }

    // Validate patient ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(401).json({
        message: "Invalid patient authentication",
      });
    }

    // Validate time slot
    if (!TIME_SLOTS.includes(appointment_time)) {
      return res.status(400).json({
        message: "Invalid appointment time",
      });
    }

    // Find patient
    const patient = await Patient.findById(
      patientId
    ).select("name email");

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    // Find doctor
    const doctor = await Doctor.findById(
      doctor_id
    ).select("name specialization");

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    // Check whether slot is already booked
    const existingAppointment =
      await Appointment.findOne({
        doctor: doctor_id,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        status: { $ne: "Cancelled" },
      });

    if (existingAppointment) {
      return res.status(409).json({
        message:
          "This time slot is already booked. Please choose another slot.",
      });
    }

    // Create appointment
    const appointment =
  await Appointment.create({
    patient: patient._id,
    doctor: doctor._id,
    appointmentDate: appointment_date,
    appointmentTime: appointment_time,
    phoneNumber: normalizedPhoneNumber,
    status: "Booked",
  });

    return res.status(201).json({
      message: "Appointment booked successfully",

      appointment: {
        id: appointment._id,
        patient_id: patient._id,
        patient_name: patient.name,
        patient_email: patient.email,
        doctor_id: doctor._id,
        doctor_name: doctor.name,
        specialization:
          doctor.specialization,
        appointment_date:
          appointment.appointmentDate,
        appointment_time:
          appointment.appointmentTime,
        phone_number: appointment.phoneNumber,
        status: appointment.status,

      },
    });
  } catch (error) {
    console.error(
      "Create appointment error:",
      error
    );

    // MongoDB duplicate index error
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "This time slot is already booked. Please choose another slot.",
      });
    }

    return res.status(500).json({
      message: "Failed to create appointment",
    });
  }
});

// =====================================================
// CANCEL APPOINTMENT
// PUT /api/appointments/:id/cancel
// =====================================================

router.put(
  "/:id/cancel",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const patientId = req.user.id;

      // Validate appointment ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      // Validate patient ID
      if (
        !mongoose.Types.ObjectId.isValid(patientId)
      ) {
        return res.status(401).json({
          message: "Invalid patient authentication",
        });
      }

      // Find appointment
      const appointment =
        await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check ownership
      if (
        appointment.patient.toString() !==
        patientId
      ) {
        return res.status(403).json({
          message:
            "You cannot cancel this appointment",
        });
      }

      // Check already cancelled
      if (
        appointment.status === "Cancelled"
      ) {
        return res.status(400).json({
          message:
            "Appointment is already cancelled",
        });
      }

      // Cancel
      appointment.status = "Cancelled";

      await appointment.save();

      return res.json({
        message:
          "Appointment cancelled successfully",

        appointment,
      });
    } catch (error) {
      console.error(
        "Cancel appointment error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to cancel appointment",
      });
    }
  }
);

// =====================================================
// RESCHEDULE APPOINTMENT
// PUT /api/appointments/:id/reschedule
// =====================================================

router.put(
  "/:id/reschedule",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        appointment_date,
        appointment_time,
      } = req.body;

      const patientId = req.user.id;

      // Validate input
      if (
        !id ||
        !appointment_date ||
        !appointment_time
      ) {
        return res.status(400).json({
          message:
            "Appointment id, appointment_date and appointment_time are required",
        });
      }

      // Validate appointment ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid appointment ID",
        });
      }

      // Validate patient ID
      if (
        !mongoose.Types.ObjectId.isValid(patientId)
      ) {
        return res.status(401).json({
          message:
            "Invalid patient authentication",
        });
      }

      // Validate time
      if (!TIME_SLOTS.includes(appointment_time)) {
        return res.status(400).json({
          message: "Invalid appointment time",
        });
      }

      // Find appointment
      const appointment =
        await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      // Check ownership
      if (
        appointment.patient.toString() !==
        patientId
      ) {
        return res.status(403).json({
          message:
            "You cannot reschedule this appointment",
        });
      }

      // Cancelled appointment cannot be rescheduled
      if (
        appointment.status === "Cancelled"
      ) {
        return res.status(400).json({
          message:
            "Cancelled appointments cannot be rescheduled",
        });
      }

      // Check slot conflict
      const conflict =
        await Appointment.findOne({
          _id: { $ne: appointment._id },

          doctor: appointment.doctor,

          appointmentDate: appointment_date,

          appointmentTime: appointment_time,

          status: { $ne: "Cancelled" },
        });

      if (conflict) {
        return res.status(409).json({
          message:
            "This time slot is already booked. Please choose another slot.",
        });
      }

      // Update appointment
      appointment.appointmentDate =
        appointment_date;

      appointment.appointmentTime =
        appointment_time;

      await appointment.save();

      return res.json({
        message:
          "Appointment rescheduled successfully",

        appointment,
      });
    } catch (error) {
      console.error(
        "Reschedule appointment error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to reschedule appointment",
      });
    }
  }
);

module.exports = router;