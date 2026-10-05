require("dotenv").config();

const { Pool } = require("pg");
const mongoose = require("mongoose");

const connectDB = require("./db");
const LegacyAppointment = require("./models/LegacyAppointment");

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

async function archiveOrphans() {
  try {
    await connectDB();

    console.log("Reading orphaned PostgreSQL appointments...");

    const result = await pgPool.query(`
      SELECT
        a.id,
        a.patient_name,
        a.patient_email,
        a.doctor_id,
        a.appointment_date,
        a.appointment_time,
        a.status
      FROM appointments a
      LEFT JOIN patients p
        ON a.patient_id = p.id
      WHERE p.id IS NULL
      ORDER BY a.id
    `);

    console.log(
      `Found ${result.rows.length} orphaned appointment(s).`
    );

    let archived = 0;

    for (const appointment of result.rows) {
      await LegacyAppointment.findOneAndUpdate(
        {
          legacyPostgresId: Number(appointment.id),
        },
        {
          legacyPostgresId: Number(appointment.id),

          patientName: appointment.patient_name,

          patientEmail: appointment.patient_email,

          doctorId: Number(appointment.doctor_id),

          appointmentDate: normalizeDate(
            appointment.appointment_date
          ),

          appointmentTime: normalizeTime(
            appointment.appointment_time
          ),

          status: normalizeStatus(
            appointment.status
          ),
        },
        {
          upsert: true,
          returnDocument: "after",
          setDefaultsOnInsert: true,
        }
      );

      archived += 1;

      console.log(
        `Archived appointment #${appointment.id}`
      );
    }

    console.log("\n=================================");
    console.log("Archive completed.");
    console.log("=================================");
    console.log(`Archived: ${archived}`);
    console.log("=================================\n");

  } catch (error) {
    console.error("Archive failed:", error);
    process.exitCode = 1;
  } finally {
    await pgPool.end();
    await mongoose.connection.close();
  }
}

archiveOrphans();