const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 150,
    },

    password: {
      type: String,
      required: true,
    },

    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [
        /^\+[1-9]\d{7,14}$/,
        "Please provide a valid phone number with country code.",
      ],
    },
  },
  {
    timestamps: true,
    collection: "patients",
  }
);

module.exports = mongoose.model("Patient", patientSchema);
