import SymptomAnalyzer from "./components/SymptomAnalyzer";

import { useEffect, useMemo, useState } from "react";

import DoctorCard from "./components/DoctorCard";

import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "";

async function apiFetch(endpoint, options = {}) {

  try {

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

    const contentType = response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")

      ? await response.json()

      : await response.text();

    if (!response.ok) {

      const message =

        typeof data === "object" && data !== null

          ? data.message

          : data;

      const error = new Error(

        message || `Request failed with status ${response.status}`

      );

      error.status = response.status;

      throw error;

    }

    return data;

  } catch (error) {

    if (error instanceof TypeError) {

      const networkError = new Error(

        "Unable to connect to SmartCare backend. Make sure the backend is running on port 8000 and CORS allows your frontend origin."

      );

      networkError.status = 0;

      throw networkError;

    }

    throw error;

  }

}

function getLoggedInUser() {

  try {

    return JSON.parse(localStorage.getItem("user")) || null;

  } catch {

    return null;

  }

}

function getAuthHeaders(includeJson = false) {

  const token = localStorage.getItem("token");

  return {

    ...(includeJson ? { "Content-Type": "application/json" } : {}),

    ...(token ? { Authorization: `Bearer ${token}` } : {}),

  };

}

const FALLBACK_DOCTORS = [];

function getDoctorInitials(name = "") {

  return name

    .replace(/^Dr\.\s\*/i, "")

    .split(/\s+/)

    .filter(Boolean)

    .slice(0, 2)

    .map((part) => part[0])

    .join("")

    .toUpperCase() || "DR";

}

function App() {

  const loggedInUser = getLoggedInUser();

  const [doctors, setDoctors] = useState(FALLBACK_DOCTORS);

  const [doctorsLoading, setDoctorsLoading] = useState(true);

  const [doctorsError, setDoctorsError] = useState("");

  const [search, setSearch] = useState("");

  const [specialization, setSpecialization] =

    useState("All Doctors");

  const [selectedDoctor, setSelectedDoctor] =

    useState(null);

  const [appointmentDate, setAppointmentDate] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");

  const [appointmentTime, setAppointmentTime] = useState("");

  const [bookingError, setBookingError] = useState("");

  const [bookingLoading, setBookingLoading] = useState(false);

  const [confirmedAppointment, setConfirmedAppointment] = useState(null);
  const [voiceCallLoading, setVoiceCallLoading] = useState(false);
  const [voiceCallMessage, setVoiceCallMessage] = useState("");

  const [darkMode, setDarkMode] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [appointments, setAppointments] = useState([]);

  const [appointmentsLoading, setAppointmentsLoading] = useState(() =>
    Boolean(localStorage.getItem("token"))
  );

  const [appointmentsError, setAppointmentsError] = useState(() =>
    localStorage.getItem("token")
      ? ""
      : "Please log in to view your appointments."
  );

  const [cancellingId, setCancellingId] = useState(null);

  const [cancellationMessage, setCancellationMessage] = useState("");

  const [cancellationError, setCancellationError] = useState("");

  // Booking availability*

  const [availableSlots, setAvailableSlots] = useState([]);

  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [availabilityError, setAvailabilityError] = useState("");

  // Rescheduling*

  const [rescheduleAppointment, setRescheduleAppointment] = useState(null);

  const [rescheduleDate, setRescheduleDate] = useState("");

  const [rescheduleTime, setRescheduleTime] = useState("");

  const [rescheduleSlots, setRescheduleSlots] = useState([]);

  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const [rescheduleError, setRescheduleError] = useState("");

  async function fetchDoctors() {
    try {

      const data = await apiFetch("/api/doctors");

      const normalizedDoctors = Array.isArray(data)

        ? data.map((doctor) => ({

            ...doctor,

            id: doctor.id || doctor._id,

            initials: doctor.initials || getDoctorInitials(doctor.name),

          }))

        : [];

      setDoctors(normalizedDoctors);

    } catch (error) {

      console.error("Fetch doctors error:", error);

      setDoctorsError(error.message || "Unable to load doctors.");

      setDoctors([]);

    } finally {

      setDoctorsLoading(false);

    }

  }

  function handleLogout() {

  localStorage.removeItem("token");

  localStorage.removeItem("user");

  window.location.reload();

}

  async function fetchAppointments({ showLoading = true } = {}) {

    const token = localStorage.getItem("token");

    if (!token) {
      return;

    }

    if (showLoading) {
      setAppointmentsLoading(true);
      setAppointmentsError("");
    }

    try {

      const data = await apiFetch("/api/appointments", {

        headers: getAuthHeaders(),

      });

      setAppointments(Array.isArray(data) ? data : []);

    } catch (error) {

      console.error("Fetch appointments error:", error);

      if (error.status === 401) {

        localStorage.removeItem("token");

        localStorage.removeItem("user");

        window.location.reload();

        return;

      }

      setAppointmentsError(

        error.message || "Unable to load appointments. Please ensure the backend is running."

      );

    } finally {

      setAppointmentsLoading(false);

    }

  }

  useEffect(() => {

    fetchDoctors();

    fetchAppointments({ showLoading: false });

  }, []);

  const specializations = useMemo(() => {

    const values = Array.from(

      new Set(doctors.map((doctor) => doctor.specialization).filter(Boolean))

    );

    return ["All Doctors", ...values];

  }, [doctors]);

  const filteredDoctors = useMemo(() => {

    return doctors.filter((doctor) => {

      const matchesSearch =

        doctor.name.toLowerCase().includes(

          search.toLowerCase()

        ) ||

        doctor.specialization.toLowerCase().includes(

          search.toLowerCase()

        ) ||

        doctor.hospital.toLowerCase().includes(

          search.toLowerCase()

        );

      const matchesSpecialization =

        specialization === "All Doctors" ||

        doctor.specialization === specialization;

      return matchesSearch && matchesSpecialization;

    });

  }, [doctors, search, specialization]);

  async function fetchAvailableSlots(doctorId, date) {

    if (!doctorId || !date) {

      setAvailableSlots([]);

      setAppointmentTime("");

      return;

    }

    setAvailabilityLoading(true);

    setAvailabilityError("");

    setAppointmentTime("");

    try {

      const data = await apiFetch(

        `/api/appointments/availability/${doctorId}?date=${date}`

      );

      setAvailableSlots(data.availableSlots || []);

    } catch (error) {

      console.error("Availability error:", error);

      setAvailableSlots([]);

      setAvailabilityError(error.message || "Unable to load available time slots.");

    } finally {

      setAvailabilityLoading(false);

    }

  }

  async function fetchRescheduleSlots(doctorId, date, appointment) {

    if (!doctorId || !date) {

      setRescheduleSlots([]);

      setRescheduleTime("");

      return;

    }

    setRescheduleLoading(true);

    setRescheduleError("");

    setRescheduleTime("");

    try {

      const data = await apiFetch(

        `/api/appointments/availability/${doctorId}?date=${date}`

      );

      let slots = data.availableSlots || [];

      if (

        appointment &&

        String(appointment.appointment_date).slice(0, 10) === date

      ) {

        const currentTime = String(appointment.appointment_time || "").slice(0, 5);

        if (currentTime && !slots.includes(currentTime)) {

          slots = [...slots, currentTime].sort();

        }

      }

      setRescheduleSlots(slots);

    } catch (error) {

      console.error("Reschedule availability error:", error);

      setRescheduleSlots([]);

      setRescheduleError(error.message || "Unable to load available time slots.");

    } finally {

      setRescheduleLoading(false);

    }

  }

  function openRescheduleModal(appointment) {

    const currentDate = appointment.appointment_date

      ? String(appointment.appointment_date).slice(0, 10)

      : "";

    const currentTime = appointment.appointment_time

      ? String(appointment.appointment_time).slice(0, 5)

      : "";

    setRescheduleAppointment(appointment);

    setRescheduleDate(currentDate);

    setRescheduleTime(currentTime);

    setRescheduleSlots([]);

    setRescheduleError("");

    setRescheduleSaving(false);

    if (appointment.doctor_id && currentDate) {

      fetchRescheduleSlots(appointment.doctor_id, currentDate, appointment);

    }

  }

  function closeRescheduleModal() {

    if (rescheduleSaving) return;

    setRescheduleAppointment(null);

    setRescheduleDate("");

    setRescheduleTime("");

    setRescheduleSlots([]);

    setRescheduleError("");

    setRescheduleSaving(false);

  }

  async function handleRescheduleAppointment(e) {

    e.preventDefault();

    if (!rescheduleAppointment) return;

    if (!rescheduleDate || !rescheduleTime) {

      setRescheduleError("Please select a date and time.");

      return;

    }

    setRescheduleSaving(true);

    setRescheduleError("");

    try {

      const data = await apiFetch(

        `/api/appointments/${rescheduleAppointment.id}/reschedule`,

        {

          method: "PUT",

          headers: getAuthHeaders(true),

          body: JSON.stringify({

            appointment_date: rescheduleDate,

            appointment_time: rescheduleTime,

          }),

        }

      );

      setCancellationMessage(data.message || "Appointment rescheduled successfully.");

      setCancellationError("");

      closeRescheduleModal();

      await fetchAppointments();

    } catch (error) {

      console.error("Rescheduling error:", error);

      if (error.status === 401) {

        localStorage.removeItem("token");

        localStorage.removeItem("user");

        window.location.reload();

        return;

      }

      setRescheduleError(error.message || "Failed to reschedule appointment.");

    } finally {

      setRescheduleSaving(false);

    }

  }

async function handleRequestVoiceCall() {
    const appointmentId = confirmedAppointment?.appointmentId;

    if (!appointmentId || appointmentId === "Saved") {
      setVoiceCallMessage("Appointment ID is missing. Please try again.");
      return;
    }

    try {
      setVoiceCallLoading(true);
      setVoiceCallMessage("");

      const data = await apiFetch("/api/voice/appointment-call", {
        method: "POST",
        headers: getAuthHeaders(true),
        body: JSON.stringify({ appointmentId }),
      });

      setVoiceCallMessage(
        data.message ||
          "SmartCare AI is calling your registered phone number now."
      );
    } catch (error) {
      console.error("Voice call error:", error);

      if (error.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.reload();
        return;
      }

      setVoiceCallMessage(
        error.message ||
          "Unable to start the SmartCare AI call. Please try again later."
      );
    } finally {
      setVoiceCallLoading(false);
    }
  }

  function handleSkipVoiceCall() {
    setVoiceCallMessage("");
    setVoiceCallLoading(false);
    setConfirmedAppointment(null);
  }

  async function handleBooking(e) {

  e.preventDefault();

  if (!selectedDoctor) return;

  setBookingError("");

  if (!localStorage.getItem("token")) {

    setBookingError("Please log in first before booking an appointment.");

    return;

  }

  if (!appointmentDate || !appointmentTime) {

    setBookingError("Please select an appointment date and time.");

    return;

  }

  const normalizedPhoneNumber = phoneNumber

    .replace(/[\s()-]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhoneNumber)) {

    setBookingError(

      "Please enter a valid phone number with country code. Example: +91 9876543210"

    );

    return;

  }

  setBookingLoading(true);

  try {

    const data = await apiFetch("/api/appointments", {

      method: "POST",

      headers: getAuthHeaders(true),

      body: JSON.stringify({

        doctor_id: selectedDoctor.id,

        appointment_date: appointmentDate,

        appointment_time: appointmentTime,

        phone_number: normalizedPhoneNumber,

      }),

    });

    setConfirmedAppointment({

      doctor: selectedDoctor,

      patientName: loggedInUser?.name || "Patient",

      patientEmail: loggedInUser?.email || "",

      phoneNumber:

        data.appointment?.phone_number ?? normalizedPhoneNumber,

      date: data.appointment?.appointment_date ?? appointmentDate,

      time: data.appointment?.appointment_time ?? appointmentTime,

      appointmentId: data.appointment?.id ?? data.id ?? "Saved",

    });

    await fetchAppointments();

    // The voice call is intentionally NOT started automatically.
    // The patient chooses whether SmartCare AI should call them.
    setVoiceCallLoading(false);
    setVoiceCallMessage("");

    setSelectedDoctor(null);



setAppointmentDate("");

setAppointmentTime("");

setPhoneNumber("");



setAvailableSlots([]);

setAvailabilityError("");

  } catch (error) {

    console.error("Booking error:", error);

    if (error.status === 401) {

      localStorage.removeItem("token");

      localStorage.removeItem("user");

      window.location.reload();

      return;

    }

    setBookingError(error.message || "Unable to book this appointment.");

  } finally {

    setBookingLoading(false);

  }

}

  async function handleCancelAppointment(appointmentId) {

    const confirmed = window.confirm("Are you sure you want to cancel this appointment?");

    if (!confirmed) return;

    setCancellingId(appointmentId);

    setCancellationMessage("");

    setCancellationError("");

    try {

      const data = await apiFetch(`/api/appointments/${appointmentId}/cancel`, {

        method: "PUT",

        headers: getAuthHeaders(true),

      });

      setCancellationMessage(data.message || "Appointment cancelled successfully.");

      await fetchAppointments();

    } catch (error) {

      console.error("Cancellation error:", error);

      if (error.status === 401) {

        localStorage.removeItem("token");

        localStorage.removeItem("user");

        window.location.reload();

        return;

      }

      setCancellationError(error.message || "Failed to cancel appointment.");

    } finally {

      setCancellingId(null);

    }

  }

  function handleBook(doctor) {

    setBookingError("");

    setBookingLoading(false);

    setAppointmentDate("");

    setAppointmentTime("");

    setPhoneNumber("");

    setAvailableSlots([]);

    setAvailabilityLoading(false);

    setAvailabilityError("");

    setSelectedDoctor(doctor);

  }

  const today = new Date().toLocaleDateString("en-CA");

  return (

    <div className={darkMode ? "app dark" : "app"}>

      <header className="navbar">

        <a href="#" className="brand">

          <span className="brand-icon">✚</span>

          SmartCare<span className="brand-ai">AI</span>

        </a>

        <button

          className="mobile-menu-button"

          onClick={() =>

            setMobileMenuOpen(!mobileMenuOpen)

          }

          aria-label="Toggle navigation"

        >

          ☰

        </button>

        <nav className={mobileMenuOpen ? "nav-links open" : "nav-links"}>

          <a href="#home" onClick={() => setMobileMenuOpen(false)}>

            Home

          </a>

          <a href="#doctors" onClick={() => setMobileMenuOpen(false)}>

            Find Doctors

          </a>

          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>

            How It Works

          </a>

          <a href="#my-appointments" onClick={() => setMobileMenuOpen(false)}>

            My Appointments

          </a>

          {loggedInUser && (

            <button

              type="button"

              className="mobile-logout-button"

              onClick={handleLogout}

            >

              Logout ({loggedInUser.name})

            </button>

          )}

        </nav>

        <div className="nav-actions">

          <button

            className="theme-toggle"

            onClick={() => setDarkMode(!darkMode)}

            aria-label="Toggle theme"

          >

            {darkMode ? "☀️" : "🌙"}

          </button>

          <a href="#doctors" className="nav-book-button">

            Book a Visit

          </a>

          {loggedInUser && (

            <div className="nav-user-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>

              <span className="nav-user-name">Hi, {loggedInUser.name}</span>

              <button

                type="button"

                className="nav-logout-button"

                style={{ border: "1px solid #d9e6e3", background: "transparent", borderRadius: "10px", padding: "9px 14px", cursor: "pointer" }}

                onClick={handleLogout}

              >

                Logout

              </button>

            </div>

          )}

        </div>

      </header>

      <main>

            <SymptomAnalyzer onBookDoctor={handleBook} />

        <section className="hero" id="home">

          <div className="hero-content">

            <div className="hero-badge">

              <span className="status-dot"></span>

              Healthcare made simpler

            </div>

            <h1>

              Your health,

              <br />

              <span>our priority.</span>

            </h1>

            <p className="hero-description">

              Find trusted doctors, book appointments

              effortlessly, and take control of your

              healthcare journey with SmartCare AI.

            </p>

            <div className="hero-actions">

              <a href="#doctors" className="primary-button">

                Find a Doctor <span>→</span>

              </a>

              <a

                href="#how-it-works"

                className="secondary-button"

              >

                How it works

              </a>

            </div>

            <div className="hero-trust">

              <div className="trust-avatars">

                <span>A</span>

                <span>R</span>

                <span>M</span>

              </div>

              <div>

                <strong>Trusted healthcare access</strong>

                <p>Simple, convenient appointment booking</p>

              </div>

            </div>

          </div>

          <div className="hero-visual">

            <div className="hero-orb"></div>

            <div className="hero-cross">✚</div>

            <div className="floating-card floating-top">

              <span className="floating-icon">✓</span>

              <div>

                <strong>Easy booking</strong>

                <p>Appointments made simple</p>

              </div>

            </div>

            <div className="doctor-illustration">

              <div className="illustration-head">

                <div className="illustration-hair"></div>

                <div className="illustration-face">

                  <span className="eye left-eye"></span>

                  <span className="eye right-eye"></span>

                  <span className="smile"></span>

                </div>

              </div>

              <div className="illustration-neck"></div>

              <div className="illustration-body">

                <div className="coat-left"></div>

                <div className="coat-right"></div>

                <div className="coat-shirt"></div>

                <div className="stethoscope"></div>

              </div>

            </div>

            <div className="floating-card floating-bottom">

              <span className="floating-icon">♡</span>

              <div>

                <strong>Your care matters</strong>

                <p>Find doctors for your needs</p>

              </div>

            </div>

          </div>

        </section>

        <section className="stats-strip">

          <div>

            <strong>Find</strong>

            <span>Doctors by specialty</span>

          </div>

          <div>

            <strong>Compare</strong>

            <span>Fees and experience</span>

          </div>

          <div>

            <strong>Book</strong>

            <span>Your preferred time</span>

          </div>

          <div>

            <strong>Manage</strong>

            <span>Your appointments</span>

          </div>

        </section>

        <section className="doctors-section" id="doctors">

          <div className="section-heading">

            <div>

              <span className="eyebrow">OUR SPECIALISTS</span>

              <h2>Find the right doctor</h2>

              <p>

                Explore our sample doctor directory

                and select a convenient appointment.

              </p>

            </div>

            <span className="doctor-count">

              {filteredDoctors.length} doctors found

            </span>

          </div>

          <div className="search-filter">

            <div className="search-box">

              <span>⌕</span>

              <input

                type="search"

                placeholder="Search doctors, specialties or hospitals..."

                value={search}

                onChange={(event) =>

                  setSearch(event.target.value)

                }

              />

            </div>

            <select

              value={specialization}

              onChange={(event) =>

                setSpecialization(event.target.value)

              }

              aria-label="Filter by specialization"

            >

              {specializations.map((item) => (

                <option key={item} value={item}>

                  {item}

                </option>

              ))}

            </select>

          </div>

          {doctorsLoading && (

            <div className="appointments-message">Loading doctors...</div>

          )}

          {doctorsError && (

            <div className="appointments-message appointments-error">

              {doctorsError}

            </div>

          )}

          {!doctorsLoading && !doctorsError && (

            <>

              <div className="doctors-grid">

                {filteredDoctors.map((doctor) => (

                  <DoctorCard

                    key={doctor.id}

                    doctor={doctor}

                    onBook={handleBook}

                  />

                ))}

              </div>

              {filteredDoctors.length === 0 && (

                <div className="empty-state">

                  <span>⌕</span>

                  <h3>No doctors found</h3>

                  <p>Try another name or specialization.</p>

                  <button

                    className="secondary-button"

                    onClick={() => {

                      setSearch("");

                      setSpecialization("All Doctors");

                    }}

                  >

                    Clear filters

                  </button>

                </div>

              )}

            </>

          )}

        </section>

        <section

          className="appointments-section"

          id="my-appointments"

        >

          <div className="section-heading">

            <div>

              <span className="eyebrow">YOUR HEALTHCARE</span>

              <h2>My Appointments</h2>

              <p>Review appointments saved in SmartCare.</p>

            </div>

            <button

              type="button"

              className="secondary-button"

              onClick={fetchAppointments}

              disabled={appointmentsLoading}

            >

              {appointmentsLoading ? "Refreshing..." : "↻ Refresh"}

            </button>

          </div>

          {appointmentsLoading && appointments.length === 0 && (

            <div className="appointments-message">Loading appointments...</div>

          )}

          {appointmentsError && (

            <div className="appointments-message appointments-error">

              {appointmentsError}

            </div>

          )}

          {cancellationMessage && (

            <div className="appointments-message appointments-success" role="status">

              {cancellationMessage}

            </div>

          )}

          {cancellationError && (

            <div className="appointments-message appointments-error" role="alert">

              {cancellationError}

            </div>

          )}

          {!appointmentsLoading && !appointmentsError &&

            appointments.length === 0 && (

              <div className="appointments-empty">

                <span>▦</span>

                <h3>No appointments yet</h3>

                <p>Book a visit with one of our doctors to see it here.</p>

                <a href="#doctors" className="primary-button">Find a Doctor</a>

              </div>

          )}

          {appointments.length > 0 && (

            <div className="appointments-grid">

              {appointments.map((appointment) => (

                <article className="appointment-card" key={appointment.id}>

                  <div className="appointment-card-header">

                    <div>

                      <span className="appointment-label">Appointment</span>

                      <h3>#{appointment.id}</h3>

                    </div>

                    <span className="appointment-status">

                      {appointment.status || "Booked"}

                    </span>

                  </div>

                  <div className="appointment-card-body">

                    <div>

                      <span>Patient</span>

                      <strong>{appointment.patient_name || "—"}</strong>

                    </div>

                    <div>

                      <span>Doctor</span>

                      <strong>

                        {appointment.doctor_name || `Doctor #${appointment.doctor_id}`}

                      </strong>

                      {appointment.specialization && (

                        <small>{appointment.specialization}</small>

                      )}

                    </div>

                    <div>

                      <span>Date</span>

                      <strong>

                        {appointment.appointment_date

                          ? String(appointment.appointment_date).slice(0, 10)

                          : "—"}

                      </strong>

                    </div>

                    <div>

                      <span>Time</span>

                      <strong>

                        {appointment.appointment_time

                          ? String(appointment.appointment_time).slice(0, 5)

                          : "—"}

                      </strong>

                    </div>

                  </div>

                  {String(appointment.status || "Booked").toLowerCase() !== "cancelled" && (

                    <div className="appointment-actions">

                      <button

                        type="button"

                        className="reschedule-appointment-button"

                        onClick={() => openRescheduleModal(appointment)}

                        disabled={

                          cancellingId === appointment.id ||

                          rescheduleSaving

                        }

                      >

                        Reschedule appointment

                      </button>

                      <button

                        type="button"

                        className="cancel-appointment-button"

                        onClick={() => handleCancelAppointment(appointment.id)}

                        disabled={

                          cancellingId === appointment.id ||

                          rescheduleSaving

                        }

                      >

                        {cancellingId === appointment.id

                          ? "Cancelling..."

                          : "Cancel appointment"}

                      </button>

                    </div>

                  )}

                </article>

              ))}

            </div>

          )}

        </section>

        <section

          className="how-section"

          id="how-it-works"

        >

          <div className="section-heading centered">

            <span className="eyebrow">SIMPLE & CONVENIENT</span>

            <h2>Healthcare in three steps</h2>

            <p>

              Your next appointment is just a few clicks away.

            </p>

          </div>

          <div className="steps-grid">

            <div className="step-card">

              <span className="step-number">01</span>

              <div className="step-icon">⌕</div>

              <h3>Find your doctor</h3>

              <p>

                Browse doctors by specialty, experience,

                and consultation fee.

              </p>

            </div>

            <div className="step-card">

              <span className="step-number">02</span>

              <div className="step-icon">▦</div>

              <h3>Choose a time</h3>

              <p>

                Select your preferred appointment date

                and time.

              </p>

            </div>

            <div className="step-card">

              <span className="step-number">03</span>

              <div className="step-icon">♡</div>

              <h3>Confirm your visit</h3>

              <p>

                Review your appointment details and

                confirm your booking.

              </p>

            </div>

          </div>

        </section>

      </main>

      <footer className="footer">

        <a href="#" className="brand">

          <span className="brand-icon">✚</span>

          SmartCare<span className="brand-ai">AI</span>

        </a>

        <p>

          © 2026 SmartCare AI. A healthcare learning

          project using fictional data.

        </p>

        <a href="#home">Back to top ↑</a>

      </footer>

      {selectedDoctor && (

        <div

          className="modal-overlay"

          onClick={() => setSelectedDoctor(null)}

        >

          <div

            className="appointment-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="booking-title"

            onClick={(event) => event.stopPropagation()}

          >

            <button

              className="modal-close"

              onClick={() => setSelectedDoctor(null)}

              aria-label="Close booking form"

            >

              ×

            </button>

            <span className="eyebrow">

              APPOINTMENT REQUEST

            </span>

            <h2 id="booking-title" className="booking-title">

              Book your appointment

            </h2>

            <div className="selected-doctor">

              <div className="doctor-avatar">

                {selectedDoctor.initials}

              </div>

              <div>

                <strong>{selectedDoctor.name}</strong>

                <p>{selectedDoctor.specialization}</p>

                <span>Consultation: ₹{selectedDoctor.fee}</span>

              </div>

            </div>

            <form className="booking-form" onSubmit={handleBooking}>

              <div className="logged-in-patient" style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "12px 14px", marginBottom: "8px", borderRadius: "12px", background: "rgba(69, 198, 174, 0.08)" }}>

                <span>Booking for</span>

                <strong>{loggedInUser?.name || "Logged-in patient"}</strong>

                <small>{loggedInUser?.email || ""}</small>

              </div>

              <div className="phone-number-field">

                <label htmlFor="phone-number">

                  Phone Number

                </label>

                <input

                  id="phone-number"

                  type="tel"

                  value={phoneNumber}

                  onChange={(event) => {

                    setPhoneNumber(event.target.value);

                    setBookingError("");

                  }}

                  placeholder="+91 9876543210"

                  autoComplete="tel"

                  required

                />

                <small>

                  We’ll use this number for your appointment call.

                </small>

              </div>

              <div className="form-row">

                <label>

                  Date

                  <input

                    type="date"

                    min={today}

                    value={appointmentDate}

                    onChange={(event) => {

                      const date = event.target.value;

                      setAppointmentDate(date);

                      setBookingError("");

                      fetchAvailableSlots(selectedDoctor.id, date);

                    }}

                    required

                  />

                </label>

                <label>

                  Time

                  <select

                    value={appointmentTime}

                    onChange={(event) => {

                      setAppointmentTime(event.target.value);

                      setBookingError("");

                    }}

                    disabled={!appointmentDate || availabilityLoading}

                    required

                  >

                    <option value="">

                      {availabilityLoading

                        ? "Loading slots..."

                        : !appointmentDate

                        ? "Select date first"

                        : availableSlots.length === 0

                        ? "No slots available"

                        : "Select time"}

                    </option>

                    {availableSlots.map((slot) => (

                      <option key={slot} value={slot}>

                        {slot}

                      </option>

                    ))}

                  </select>

                </label>

              </div>

              {availabilityError && (

                <div className="booking-form-error" role="alert">

                  <span aria-hidden="true">⚠</span>

                  <span>{availabilityError}</span>

                </div>

              )}

              {appointmentDate &&

                !availabilityLoading &&

                !availabilityError &&

                availableSlots.length === 0 && (

                  <div className="booking-form-error" role="alert">

                    <span aria-hidden="true">⚠</span>

                    <span>

                      No available time slots for this doctor on the selected

                      date.

                    </span>

                  </div>

                )}

              {bookingError && (

                <div className="booking-form-error" role="alert">

                  <span aria-hidden="true">⚠</span>

                  <span>{bookingError}</span>

                </div>

              )}

              <button className="booking-submit" type="submit" disabled={bookingLoading}>

                <span>{bookingLoading ? "Booking..." : "Confirm appointment"}</span>

                <span aria-hidden="true">→</span>

              </button>

              <p className="form-disclaimer">

                Demo only. No real appointment is created

                or sent to a healthcare provider.

              </p>

            </form>

          </div>

        </div>

      )}

      {rescheduleAppointment && (

        <div

          className="modal-overlay"

          onClick={closeRescheduleModal}

        >

          <div

            className="appointment-modal"

            role="dialog"

            aria-modal="true"

            aria-labelledby="reschedule-title"

            onClick={(event) => event.stopPropagation()}

          >

            <button

              className="modal-close"

              onClick={closeRescheduleModal}

              aria-label="Close reschedule form"

              disabled={rescheduleSaving}

            >

              ×

            </button>

            <span className="eyebrow">MANAGE APPOINTMENT</span>

            <h2 id="reschedule-title" className="booking-title">

              Reschedule your appointment

            </h2>

            <div className="selected-doctor">

              <div className="doctor-avatar">

                {rescheduleAppointment.doctor_name

                  ? rescheduleAppointment.doctor_name

                      .split(" ")

                      .map((part) => part[0])

                      .slice(0, 2)

                      .join("")

                  : "DR"}

              </div>

              <div>

                <strong>

                  {rescheduleAppointment.doctor_name ||

                    `Doctor #${rescheduleAppointment.doctor_id}`}

                </strong>

                {rescheduleAppointment.specialization && (

                  <p>{rescheduleAppointment.specialization}</p>

                )}

                <span>

                  Current:{" "}

                  {rescheduleAppointment.appointment_date

                    ? String(rescheduleAppointment.appointment_date).slice(0, 10)

                    : "—"}{" "}

                  at{" "}

                  {rescheduleAppointment.appointment_time

                    ? String(rescheduleAppointment.appointment_time).slice(0, 5)

                    : "—"}

                </span>

              </div>

            </div>

            <form

              className="booking-form"

              onSubmit={handleRescheduleAppointment}

            >

              <div className="form-row">

                <label>

                  New date

                  <input

                    type="date"

                    min={today}

                    value={rescheduleDate}

                    onChange={(event) => {

                      const date = event.target.value;

                      setRescheduleDate(date);

                      setRescheduleError("");

                      fetchRescheduleSlots(

                        rescheduleAppointment.doctor_id,

                        date,

                        rescheduleAppointment

                      );

                    }}

                    required

                  />

                </label>

                <label>

                  New time

                  <select

                    value={rescheduleTime}

                    onChange={(event) => {

                      setRescheduleTime(event.target.value);

                      setRescheduleError("");

                    }}

                    disabled={!rescheduleDate || rescheduleLoading}

                    required

                  >

                    <option value="">

                      {rescheduleLoading

                        ? "Loading slots..."

                        : !rescheduleDate

                        ? "Select date first"

                        : rescheduleSlots.length === 0

                        ? "No slots available"

                        : "Select time"}

                    </option>

                    {rescheduleSlots.map((slot) => (

                      <option key={slot} value={slot}>

                        {slot}

                      </option>

                    ))}

                  </select>

                </label>

              </div>

              {rescheduleError && (

                <div className="reschedule-form-error" role="alert">

                  <span aria-hidden="true">⚠</span>

                  <span>{rescheduleError}</span>

                </div>

              )}

              {rescheduleDate &&

                !rescheduleLoading &&

                !rescheduleError &&

                rescheduleSlots.length === 0 && (

                  <div className="reschedule-form-error" role="alert">

                    <span aria-hidden="true">⚠</span>

                    <span>

                      No available time slots for the selected date.

                    </span>

                  </div>

                )}

              <button

                className="booking-submit"

                type="submit"

                disabled={rescheduleSaving || !rescheduleTime}

              >

                <span>

                  {rescheduleSaving

                    ? "Rescheduling..."

                    : "Confirm reschedule"}

                </span>

                <span aria-hidden="true">→</span>

              </button>

            </form>

          </div>

        </div>

      )}

      {confirmedAppointment && (

        <div

          className="modal-overlay"

          onClick={() => setConfirmedAppointment(null)}

        >

          <div

            className="appointment-modal confirmation-modal"

            role="dialog"

            aria-modal="true"

            onClick={(event) => event.stopPropagation()}

          >

            <button

              className="modal-close"

              onClick={() => setConfirmedAppointment(null)}

            >

              ×

            </button>

            <div className="confirmation-icon">✓</div>

            <span className="eyebrow">BOOKING CONFIRMATION</span>

            <h2>Appointment details saved</h2>

            <p className="confirmation-message">

              Thank you, {confirmedAppointment.patientName || loggedInUser?.name || "Patient"}.

              Your appointment has been saved successfully.

            </p>

            <div className="confirmation-details">

              <div>

                <span>Booking ID</span>

                <strong>{confirmedAppointment.appointmentId}</strong>

              </div>

              <div>

                <span>Doctor</span>

                <strong>{confirmedAppointment.doctor.name}</strong>

              </div>

              <div>

                <span>Date</span>

                <strong>{confirmedAppointment.date}</strong>

              </div>

              <div>

                <span>Time</span>

                <strong>{confirmedAppointment.time}</strong>

              </div>

              <div>

                <span>Consultation fee</span>

                <strong>

                  ₹{confirmedAppointment.doctor.fee}

                </strong>

              </div>

            </div>

            <div className="voice-confirmation-section">
              <div className="voice-confirmation-icon" aria-hidden="true">
                📞
              </div>
              <h3>Would you like SmartCare AI to call you?</h3>
              <p>
                Our AI assistant can call your registered phone number and
                help you confirm, cancel, or reschedule this appointment.
              </p>

              {voiceCallMessage && (
                <div className="voice-call-message" role="status">
                  {voiceCallMessage}
                </div>
              )}

              <div className="voice-confirmation-actions">
                <button
                  type="button"
                  className="voice-call-button"
                  onClick={handleRequestVoiceCall}
                  disabled={voiceCallLoading}
                >
                  {voiceCallLoading ? "Calling..." : "📞 Yes, Call Me"}
                </button>

                <button
                  type="button"
                  className="voice-later-button"
                  onClick={handleSkipVoiceCall}
                  disabled={voiceCallLoading}
                >
                  Maybe Later
                </button>
              </div>
            </div>

            <button
              type="button"
              className="primary-button full-width"
              onClick={handleSkipVoiceCall}
              disabled={voiceCallLoading}
            >
              Done
            </button>

          </div>

        </div>

      )}

    </div>

  );

}

export default App;
