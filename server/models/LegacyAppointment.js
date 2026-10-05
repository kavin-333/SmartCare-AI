const mongoose = require("mongoose");

const legacyAppointmentSchema = new mongoose.Schema(
  {
    legacyPostgresId: {
      type: Number,
      required: true,
      unique: true,
    },

    patientName: {
      type: String,
      required: true,
    },

    patientEmail: {
      type: String,
      required: true,
    },

    doctorId: {
      type: Number,
      required: true,
    },

    appointmentDate: {
      type: String,
      required: true,
    },

    appointmentTime: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Booked", "Cancelled"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "LegacyAppointment",
  legacyAppointmentSchema
);