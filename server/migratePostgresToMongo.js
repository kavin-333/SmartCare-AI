/*
 * One-time PostgreSQL -> MongoDB migration for SmartCare.
 *
 * Keeps the pg package installed while running this script.
 *
 * Migration:
 *   patients
 *   doctors
 *   appointments
 *
 * Patient mapping:
 *   1. Uses PostgreSQL patient_id when available.
 *   2. If patient_id is NULL, uses patient_email.
 *
 * Existing patient passwords are copied as already-hashed values.
 *
 * Existing PostgreSQL numeric IDs are mapped to MongoDB ObjectIds.
 *
 * Appointments use legacyPostgresId so the migration can safely
 * be run again without creating duplicates.
 *
 * Run:
 *   node migratePostgresToMongo.js
 */

require("dotenv").config();

const { Pool } = require("pg");
const mongoose = require("mongoose");

const connectDB = require("./db");
const Patient = require("./models/Patient");
const Doctor = require("./models/Doctor");
const Appointment = require("./models/Appointment");

const pgPool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "127.0.0.1",
  database: process.env.PGDATABASE || "smartcare",
  password: process.env.PGPASSWORD || "1234",
  port: Number(process.env.PGPORT || 5432),
});

function normalizeDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function normalizeTime(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(11, 16);
  }

  return String(value).slice(0, 5);
}

function normalizeStatus(value) {
  return String(value || "Booked").toLowerCase() === "cancelled"
    ? "Cancelled"
    : "Booked";
}

function initials(name = "") {
  return name
    .replace(/^Dr\.\s*/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function migrate() {
  const patientMap = new Map();
  const patientEmailMap = new Map();
  const doctorMap = new Map();

  try {
    await connectDB();

    // =========================================================
    // 1. MIGRATE PATIENTS
    // =========================================================

    console.log("Reading PostgreSQL patients...");

    const patientsResult = await pgPool.query(`
      SELECT id, name, email, password, created_at
      FROM patients
      ORDER BY id
    `);

    console.log(
      `Found ${patientsResult.rows.length} PostgreSQL patient(s).`
    );

    for (const oldPatient of patientsResult.rows) {
      const email = oldPatient.email
        ? oldPatient.email.toLowerCase().trim()
        : null;

      if (!email) {
        console.warn(
          `Skipping patient #${oldPatient.id}: email is missing.`
        );
        continue;
      }

      const patient = await Patient.findOneAndUpdate(
        { email },
        {
          $set: {
            name: oldPatient.name,
            email,
            password: oldPatient.password,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        }
      );

      // PostgreSQL ID -> MongoDB ObjectId
      patientMap.set(
        Number(oldPatient.id),
        patient._id
      );

      // PostgreSQL email -> MongoDB ObjectId
      patientEmailMap.set(
        email,
        patient._id
      );
    }

    // =========================================================
    // 2. MIGRATE DOCTORS
    // =========================================================

    console.log("Reading PostgreSQL doctors...");

    const doctorsResult = await pgPool.query(`
      SELECT *
      FROM doctors
      ORDER BY id
    `);

    console.log(
      `Found ${doctorsResult.rows.length} PostgreSQL doctor(s).`
    );

    for (const oldDoctor of doctorsResult.rows) {
      const doctor = await Doctor.findOneAndUpdate(
        {
          name: oldDoctor.name,
        },
        {
          $set: {
            name: oldDoctor.name,
            initials:
              oldDoctor.initials || initials(oldDoctor.name),

            specialization:
              oldDoctor.specialization || "General Physician",

            rating: Number(oldDoctor.rating || 0),

            reviews: Number(oldDoctor.reviews || 0),

            experience: Number(oldDoctor.experience || 0),

            fee: Number(oldDoctor.fee || 0),

            hospital:
              oldDoctor.hospital || "SmartCare Hospital",
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        }
      );

      doctorMap.set(
        Number(oldDoctor.id),
        doctor._id
      );
    }

    // =========================================================
    // 3. READ APPOINTMENTS
    // =========================================================

    console.log("Reading PostgreSQL appointments...");

    const appointmentsResult = await pgPool.query(`
      SELECT
        id,
        patient_id,
        patient_email,
        doctor_id,
        appointment_date,
        appointment_time,
        status
      FROM appointments
      ORDER BY id
    `);

    console.log(
      `Found ${appointmentsResult.rows.length} PostgreSQL appointment(s).`
    );

    let imported = 0;
    let skipped = 0;

    // =========================================================
    // 4. MIGRATE APPOINTMENTS
    // =========================================================

    for (const oldAppointment of appointmentsResult.rows) {

      // -------------------------------------------------------
      // Find patient using patient_id first
      // -------------------------------------------------------

      let patientId = null;

      if (oldAppointment.patient_id !== null) {
        patientId = patientMap.get(
          Number(oldAppointment.patient_id)
        );
      }

      // -------------------------------------------------------
      // FALLBACK:
      // If patient_id is NULL, use patient_email
      // -------------------------------------------------------

      if (!patientId && oldAppointment.patient_email) {
        const email = oldAppointment.patient_email
          .toLowerCase()
          .trim();

        patientId = patientEmailMap.get(email);

        if (patientId) {
          console.log(
            `Appointment #${oldAppointment.id}: patient matched using email ${email}`
          );
        }
      }

      // -------------------------------------------------------
      // Find doctor
      // -------------------------------------------------------

      const doctorId = doctorMap.get(
        Number(oldAppointment.doctor_id)
      );

      // -------------------------------------------------------
      // Validate patient + doctor
      // -------------------------------------------------------

      if (!patientId || !doctorId) {
        skipped += 1;

        console.warn(
          `Skipping appointment #${oldAppointment.id}:`
          + ` patient or doctor mapping not found.`
        );

        continue;
      }

      // -------------------------------------------------------
      // Normalize date/time
      // -------------------------------------------------------

      const appointmentDate = normalizeDate(
        oldAppointment.appointment_date
      );

      const appointmentTime = normalizeTime(
        oldAppointment.appointment_time
      );

      if (!appointmentDate || !appointmentTime) {
        skipped += 1;

        console.warn(
          `Skipping appointment #${oldAppointment.id}:`
          + ` invalid date/time.`
        );

        continue;
      }

      // -------------------------------------------------------
      // Create/update appointment
      // -------------------------------------------------------

      try {
        const existingAppointment =
          await Appointment.findOne({
            legacyPostgresId: Number(oldAppointment.id),
          });

        if (existingAppointment) {
          console.log(
            `Appointment #${oldAppointment.id} already migrated.`
          );

          skipped += 1;
          continue;
        }

        await Appointment.create({
          legacyPostgresId: Number(oldAppointment.id),

          patient: patientId,

          doctor: doctorId,

          appointmentDate,

          appointmentTime,

          status: normalizeStatus(
            oldAppointment.status
          ),
        });

        imported += 1;

        console.log(
          `Imported appointment #${oldAppointment.id}`
        );

      } catch (error) {

        if (error.code === 11000) {
          console.warn(
            `Skipping duplicate appointment #${oldAppointment.id}.`
          );

          skipped += 1;
          continue;
        }

        throw error;
      }
    }

    // =========================================================
    // 5. SUMMARY
    // =========================================================

    console.log("\n=================================");
    console.log("Migration completed.");
    console.log("=================================");

    console.log(
      `Patients mapped: ${patientMap.size}`
    );

    console.log(
      `Doctors mapped: ${doctorMap.size}`
    );

    console.log(
      `Appointments imported: ${imported}`
    );

    console.log(
      `Appointments skipped: ${skipped}`
    );

    console.log("=================================\n");

  } catch (error) {

    console.error(
      "Migration failed:",
      error
    );

    process.exitCode = 1;

  } finally {

    await pgPool.end();
    await mongoose.connection.close();

  }
}

migrate();