require("dotenv").config();

const connectDB = require("./db");
const Doctor = require("./models/Doctor");

const doctors = [
  {
    name: "Dr. Ananya Sharma",
    initials: "AS",
    specialization: "Cardiologist",
    rating: 4.9,
    reviews: 128,
    experience: 12,
    fee: 800,
    hospital: "Apollo Hospitals",
  },
  {
    name: "Dr. Rahul Mehta",
    initials: "RM",
    specialization: "Dermatologist",
    rating: 4.8,
    reviews: 96,
    experience: 9,
    fee: 600,
    hospital: "Fortis Hospital",
  },
  {
    name: "Dr. Priya Nair",
    initials: "PN",
    specialization: "Pediatrician",
    rating: 4.9,
    reviews: 143,
    experience: 11,
    fee: 700,
    hospital: "MIOT International",
  },
  {
    name: "Dr. Arjun Kumar",
    initials: "AK",
    specialization: "Orthopedic Surgeon",
    rating: 4.7,
    reviews: 87,
    experience: 10,
    fee: 750,
    hospital: "SRM Hospital",
  },
  {
    name: "Dr. Meera Iyer",
    initials: "MI",
    specialization: "Gynecologist",
    rating: 4.8,
    reviews: 112,
    experience: 13,
    fee: 700,
    hospital: "Kauvery Hospital",
  },
  {
    name: "Dr. Vikram Rao",
    initials: "VR",
    specialization: "Neurologist",
    rating: 4.9,
    reviews: 105,
    experience: 15,
    fee: 900,
    hospital: "Global Hospitals",
  },
];

async function seedDoctors() {
  try {
    await connectDB();

    // Prevent duplicate doctors if the seed script is run again
    await Doctor.deleteMany({});

    const insertedDoctors = await Doctor.insertMany(doctors);

    console.log(
      `Inserted ${insertedDoctors.length} doctors into MongoDB.`
    );

    insertedDoctors.forEach((doctor) => {
      console.log(
        `${doctor.name} → ${doctor._id}`
      );
    });

    process.exit(0);
  } catch (error) {
    console.error(
      "Failed to seed doctors:",
      error.message
    );

    process.exit(1);
  }
}

seedDoctors();