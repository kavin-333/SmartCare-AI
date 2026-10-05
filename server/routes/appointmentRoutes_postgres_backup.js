const express = require("express");
const mongoose = require("mongoose");

const authenticateToken = require("../middleware/authMiddleware");
const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");

const router = express.Router();

const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
];

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function appointmentToResponse(appointment) {
  const patient = appointment.patient;
  const doctor = appointment.doctor;

  return {
    id: appointment._id.toString(),

    patient_id: patient?._id?.toString() || null,
    patient_name: patient?.name || "",
    patient_email: patient?.email || "",

    doctor_id: doctor?._id?.toString() || null,
    doctor_name: doctor?.name || "",
    specialization: doctor?.specialization || "",

    appointment_date: appointment.appointmentDate,
    appointment_time: appointment.appointmentTime,
    status: appointment.status,

    created_at: appointment.createdAt,
    updated_at: appointment.updatedAt,
  };
}

// =====================================================
// GET AVAILABLE TIME SLOTS
// GET /api/appointments/availability/:doctorId?date=2027-03-20
// =====================================================

router.get("/availability/:doctorId", async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!doctorId || !date) {
      return res.status(400).json({
        message: "doctorId and date are required",
      });
    }

    if (!isValidObjectId(doctorId)) {
      return res.status(400).json({
        message: "Invalid doctor id",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        message: "Date must use YYYY-MM-DD format",
      });
    }

    const doctor = await Doctor.findById(doctorId).select("name");

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    const bookedAppointments = await Appointment.find({
      doctor: doctor._id,
      appointmentDate: date,
      status: "Booked",
    }).select("appointmentTime");

    const bookedSlots = bookedAppointments.map(
      (appointment) => appointment.appointmentTime
    );

    const availableSlots = TIME_SLOTS.filter(
      (slot) => !bookedSlots.includes(slot)
    );

    return res.json({
      doctorId: doctor._id.toString(),
      doctorName: doctor.name,
      date,
      availableSlots,
    });
  } catch (error) {
    console.error("Availability error:", error);

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
    if (!isValidObjectId(req.user.id)) {
      return res.status(401).json({
        message: "Invalid patient authentication",
      });
    }

    const appointments = await Appointment.find({
      patient: req.user.id,
    })
      .populate("patient", "name email")
      .populate(
        "doctor",
        "name specialization initials rating reviews experience fee hospital"
      )
      .sort({
        appointmentDate: 1,
        appointmentTime: 1,
      });

    return res.json(
      appointments.map(appointmentToResponse)
    );
  } catch (error) {
    console.error("Get appointments error:", error);

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
    } = req.body;

    const patientId = req.user.id;

    if (
      !doctor_id ||
      !appointment_date ||
      !appointment_time
    ) {
      return res.status(400).json({
        message:
          "doctor_id, appointment_date and appointment_time are required",
      });
    }

    if (!isValidObjectId(patientId)) {
      return res.status(401).json({
        message: "Invalid patient authentication",
      });
    }

    if (!isValidObjectId(doctor_id)) {
      return res.status(400).json({
        message: "Invalid doctor id",
      });
    }

    if (!isValidDate(appointment_date)) {
      return res.status(400).json({
        message: "Date must use YYYY-MM-DD format",
      });
    }

    if (!TIME_SLOTS.includes(appointment_time)) {
      return res.status(400).json({
        message: "Invalid appointment time",
      });
    }

    const [patient, doctor] = await Promise.all([
      Patient.findById(patientId).select("name email"),
      Doctor.findById(doctor_id),
    ]);

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found",
      });
    }

    if (!doctor) {
      return res.status(404).json({
        message: "Doctor not found",
      });
    }

    // Application-level availability check for a friendly error.
    const existingAppointment = await Appointment.findOne({
      doctor: doctor._id,
      appointmentDate: appointment_date,
      appointmentTime: appointment_time,
      status: "Booked",
    });

    if (existingAppointment) {
      return res.status(409).json({
        message:
          "This time slot is already booked. Please choose another slot.",
      });
    }

    try {
      const appointment = await Appointment.create({
        patient: patient._id,
        doctor: doctor._id,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        status: "Booked",
      });

      await appointment.populate([
        { path: "patient", select: "name email" },
        {
          path: "doctor",
          select:
            "name specialization initials rating reviews experience fee hospital",
        },
      ]);

      return res.status(201).json({
        message: "Appointment booked successfully",
        appointment: appointmentToResponse(appointment),
      });
    } catch (error) {
      // Handles the MongoDB unique partial index race condition.
      if (error.code === 11000) {
        return res.status(409).json({
          message:
            "This time slot is already booked. Please choose another slot.",
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Create appointment error:", error);

    return res.status(500).json({
      message: "Failed to create appointment",
    });
  }
});

// =====================================================
// CANCEL APPOINTMENT
// PUT /api/appointments/:id/cancel
// =====================================================

router.put("/:id/cancel", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        message: "Valid appointment id is required",
      });
    }

    if (!isValidObjectId(req.user.id)) {
      return res.status(401).json({
        message: "Invalid patient authentication",
      });
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found",
      });
    }

    if (appointment.patient.toString() !== req.user.id) {
      return res.status(403).json({
        message: "You cannot cancel this appointment",
      });
    }

    if (appointment.status === "Cancelled") {
      return res.status(400).json({
        message: "Appointment is already cancelled",
      });
    }

    appointment.status = "Cancelled";
    await appointment.save();

    await appointment.populate([
      { path: "patient", select: "name email" },
      {
        path: "doctor",
        select:
          "name specialization initials rating reviews experience fee hospital",
      },
    ]);

    return res.json({
      message: "Appointment cancelled successfully",
      appointment: appointmentToResponse(appointment),
    });
  } catch (error) {
    console.error("Cancel appointment error:", error);

    return res.status(500).json({
      message: "Failed to cancel appointment",
    });
  }
});

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

      if (!isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid appointment id",
        });
      }

      if (!isValidObjectId(req.user.id)) {
        return res.status(401).json({
          message: "Invalid patient authentication",
        });
      }

      if (!isValidDate(appointment_date)) {
        return res.status(400).json({
          message: "Date must use YYYY-MM-DD format",
        });
      }

      if (!TIME_SLOTS.includes(appointment_time)) {
        return res.status(400).json({
          message: "Invalid appointment time",
        });
      }

      const appointment = await Appointment.findById(id);

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found",
        });
      }

      if (appointment.patient.toString() !== req.user.id) {
        return res.status(403).json({
          message:
            "You cannot reschedule this appointment",
        });
      }

      if (appointment.status === "Cancelled") {
        return res.status(400).json({
          message:
            "Cancelled appointments cannot be rescheduled",
        });
      }

      const conflict = await Appointment.findOne({
        _id: { $ne: appointment._id },
        doctor: appointment.doctor,
        appointmentDate: appointment_date,
        appointmentTime: appointment_time,
        status: "Booked",
      });

      if (conflict) {
        return res.status(409).json({
          message:
            "This time slot is already booked. Please choose another slot.",
        });
      }

      appointment.appointmentDate = appointment_date;
      appointment.appointmentTime = appointment_time;

      try {
        await appointment.save();
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({
            message:
              "This time slot is already booked. Please choose another slot.",
          });
        }

        throw error;
      }

      await appointment.populate([
        { path: "patient", select: "name email" },
        {
          path: "doctor",
          select:
            "name specialization initials rating reviews experience fee hospital",
        },
      ]);

      return res.json({
        message:
          "Appointment rescheduled successfully",
        appointment: appointmentToResponse(appointment),
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
