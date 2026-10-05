const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    legacyPostgresId: {
      type: Number,
      unique: true,
      sparse: true,
    },

    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
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

    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Booked", "Confirmed", "Cancelled"],
      default: "Booked",
    },

    // Patient's preferred language for the voice call.
    voiceLanguage: {
      type: String,
      enum: [
        "en-IN",
        "ta-IN",
        "hi-IN",
        "te-IN",
        "ml-IN",
        "kn-IN",
      ],
      default: "en-IN",
    },

    voiceConversation: {
      active: {
        type: Boolean,
        default: false,
      },

      step: {
        type: String,
        enum: [
          "NONE",
          "WAITING_FOR_DATE",
          "WAITING_FOR_TIME",
        ],
        default: "NONE",
      },

      requestedDate: {
        type: String,
        default: null,
      },

      requestedTime: {
        type: String,
        default: null,
      },

      attempts: {
        type: Number,
        default: 0,
      },
    },

    voiceCall: {
      sid: {
        type: String,
        default: null,
      },

      status: {
        type: String,
        default: null,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },
    },
  },

  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Appointment",
  appointmentSchema
);