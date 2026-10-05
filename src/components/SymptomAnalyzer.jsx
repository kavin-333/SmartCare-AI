import { useState, useRef } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://localhost:8000"
    : "";

function SymptomAnalyzer({ onBookDoctor }) {
  const [symptoms, setSymptoms] = useState("");
  const [result, setResult] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [isListening, setIsListening] =
    useState(false);

  const [isSpeaking, setIsSpeaking] =
    useState(false);

  const [language, setLanguage] =
    useState("en-IN");

  const recognitionRef = useRef(null);

  // =========================
  // SUPPORTED LANGUAGES
  // =========================

  const languages = [
    {
      code: "en-IN",
      name: "English",
    },
    {
      code: "ta-IN",
      name: "தமிழ் (Tamil)",
    },
    {
      code: "hi-IN",
      name: "हिन्दी (Hindi)",
    },
    {
      code: "te-IN",
      name: "తెలుగు (Telugu)",
    },
    {
      code: "ml-IN",
      name: "മലയാളം (Malayalam)",
    },
    {
      code: "kn-IN",
      name: "ಕನ್ನಡ (Kannada)",
    },
  ];

  // =========================
  // VOICE INPUT
  // =========================

  const startVoiceInput = () => {
    setError("");

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );

      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();

      setIsListening(false);

      return;
    }

    const recognition =
      new SpeechRecognition();

    // Use selected language
    recognition.lang = language;

    recognition.continuous = false;

    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript;

      setSymptoms((previous) => {
        if (!previous.trim()) {
          return transcript;
        }

        return `${previous.trim()} ${transcript}`;
      });
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      if (event.error === "not-allowed") {
        setError(
          "Microphone permission was denied. Please allow microphone access and try again."
        );
      } else if (
        event.error ===
        "language-not-supported"
      ) {
        setError(
          "The selected language is not supported by your browser's speech recognition."
        );
      } else {
        setError(
          "Unable to capture your voice. Please try again."
        );
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    recognition.start();
  };

  // =========================
  // AI VOICE RESPONSE
  // =========================

  const speakResult = (data) => {
    if (!("speechSynthesis" in window)) {
      setError(
        "Text-to-speech is not supported in this browser."
      );

      return;
    }

    // Stop previous speech
    window.speechSynthesis.cancel();

    // ========================================
    // SPEAK ONLY SAFETY GUIDANCE
    // ========================================

    const safetyText =
      data.safetyGuidance?.join(". ") || "";

    if (!safetyText.trim()) {
      setError(
        "No safety guidance is available to speak."
      );

      return;
    }

    const utterance =
      new SpeechSynthesisUtterance(
        safetyText
      );

    // Use selected language
    utterance.lang = language;

    utterance.rate = 0.95;

    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);

      setError(
        "Unable to speak the safety guidance."
      );
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  // =========================
  // STOP AI SPEAKING
  // =========================

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();

    setIsSpeaking(false);
  };

  // =========================
  // FIND MATCHING DOCTORS
  // =========================

  const findMatchingDoctors = async (
    specialty
  ) => {
    if (!specialty) {
      setDoctors([]);

      return;
    }

    setDoctorsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/ai/doctors/${encodeURIComponent(
          specialty
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        setDoctors([]);

        return;
      }

      setDoctors(data.doctors || []);
    } catch (error) {
      console.error(
        "Failed to fetch matching doctors:",
        error
      );

      setDoctors([]);

      setError(
        "Unable to load matching doctors."
      );
    } finally {
      setDoctorsLoading(false);
    }
  };

  // =========================
  // AI SYMPTOM ANALYSIS
  // =========================

  const analyzeSymptoms = async () => {
    if (!symptoms.trim()) {
      setError(
        "Please describe your symptoms first."
      );

      return;
    }

    // Stop previous speech
    stopSpeaking();

    setLoading(true);

    setError("");

    setResult(null);

    // Clear doctors from previous analysis
    setDoctors([]);

    try {
      // ========================================
      // STEP 1: SEND SYMPTOMS TO GEMINI
      // ========================================

      const response = await fetch(
        `${API_BASE_URL}/api/ai/analyze-symptoms`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            symptoms: symptoms.trim(),
            language: language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to analyze symptoms."
        );
      }

      // ========================================
      // STEP 2: SHOW AI RESULT
      // ========================================

      setResult(data);

      // ========================================
      // STEP 3: FIND MATCHING DOCTORS
      // ========================================

      const specialty =
        data.databaseSpecialty ||
        data.specialtyKey;

      await findMatchingDoctors(
        specialty
      );

      // ========================================
      // STEP 4: SPEAK SAFETY GUIDANCE
      // ========================================

      speakResult(data);
    } catch (error) {
      console.error(
        "Symptom analysis error:",
        error
      );

      setError(
        error.message ||
          "Unable to analyze symptoms. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // RENDER
  // =========================

  return (
    <section className="w-full max-w-4xl mx-auto p-6">
      {/* Header */}

      <div className="mb-6">
        <h2 className="text-3xl font-bold">
          SmartCare AI Symptom Analyzer
        </h2>

        <p className="mt-2 text-gray-600">
          Describe your symptoms using text
          or your voice and SmartCare AI will
          suggest an appropriate medical
          specialty and matching doctors.
        </p>
      </div>

      {/* Input Card */}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {/* Language Selection */}

        <div className="mb-5">
          <label
            htmlFor="language"
            className="mb-2 block text-sm font-semibold"
          >
            Select your language
          </label>

          <select
            id="language"
            value={language}
            onChange={(e) => {
              // Stop listening if language changes
              if (isListening) {
                recognitionRef.current?.stop();

                setIsListening(false);
              }

              // Stop current speech
              stopSpeaking();

              setLanguage(e.target.value);
            }}
            className="w-full rounded-xl border p-3 outline-none focus:ring-2"
          >
            {languages.map((item) => (
              <option
                key={item.code}
                value={item.code}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Symptoms Label */}

        <label
          htmlFor="symptoms"
          className="mb-2 block text-sm font-semibold"
        >
          Describe your symptoms
        </label>

        {/* Symptoms Textarea */}

        <textarea
          id="symptoms"
          value={symptoms}
          onChange={(e) =>
            setSymptoms(e.target.value)
          }
          placeholder="Example: I have a skin rash and itching..."
          rows={6}
          className="w-full resize-none rounded-xl border p-4 outline-none focus:ring-2"
        />

        {/* Voice Button */}

        <button
          type="button"
          onClick={startVoiceInput}
          className={`mt-4 rounded-xl px-6 py-3 font-semibold text-white transition-all duration-200 ${
            isListening
              ? "bg-red-600 hover:bg-red-700"
              : "bg-[#0f2f3f] hover:bg-[#16465d]"
          }`}
        >
          {isListening
            ? "🎤 Listening..."
            : "🎤 Speak Symptoms"}
        </button>

        {/* Listening Message */}

        {isListening && (
          <p className="mt-3 text-sm text-gray-600">
            Speak clearly and describe your
            symptoms...
          </p>
        )}

        {/* Error */}

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Analyze Button */}

        <button
          type="button"
          onClick={analyzeSymptoms}
          disabled={loading}
          className="mt-4 ml-3 rounded-xl bg-[#0f2f3f] px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-[#16465d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Analyzing..."
            : "Analyze Symptoms"}
        </button>
      </div>

      {/* Results */}

      {result && (
        <div className="mt-6 space-y-5">
          {/* Symptoms */}

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold">
              Symptoms Identified
            </h3>

            <div className="mt-3 flex flex-wrap gap-2">
              {result.symptoms?.map(
                (symptom, index) => (
                  <span
                    key={index}
                    className="rounded-full border px-3 py-1 text-sm"
                  >
                    {symptom}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Specialty */}

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold">
              Recommended Specialty
            </h3>

            <p className="mt-2 text-2xl font-bold">
              {result.specialty}
            </p>
          </div>

          {/* Matching Doctors */}

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  Recommended Doctors
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Doctors matching the AI-recommended
                  specialty
                </p>
              </div>

              {!doctorsLoading &&
                doctors.length > 0 && (
                  <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                    {doctors.length} found
                  </span>
                )}
            </div>

            {/* Loading */}

            {doctorsLoading && (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#0f2f3f]" />

                <span>
                  Finding suitable doctors...
                </span>
              </div>
            )}

            {/* No Doctors */}

            {!doctorsLoading &&
              doctors.length === 0 && (
                <div className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  No doctors are currently available
                  for this specialty.
                </div>
              )}

            {/* Doctor Cards */}

            {!doctorsLoading &&
              doctors.length > 0 && (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {doctors.map((doctor) => (
                    <div
                      key={doctor._id}
                      className="rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
                    >
                      {/* Doctor Header */}

                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0f2f3f] text-lg font-bold text-white">
                          {doctor.initials ||
                            doctor.name
                              ?.split(" ")
                              .map(
                                (word) =>
                                  word[0]
                              )
                              .join("")
                              .slice(0, 2)}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold">
                            {doctor.name}
                          </h4>

                          <p className="text-sm text-gray-500">
                            {doctor.specialization}
                          </p>
                        </div>
                      </div>

                      {/* Doctor Details */}

                      <div className="mt-4 space-y-2 text-sm text-gray-700">
                        <p>
                          <span className="font-semibold">
                            Hospital:
                          </span>{" "}
                          {doctor.hospital}
                        </p>

                        <p>
                          <span className="font-semibold">
                            Experience:
                          </span>{" "}
                          {doctor.experience} years
                        </p>

                        <p>
                          <span className="font-semibold">
                            Consultation Fee:
                          </span>{" "}
                          ₹{doctor.fee}
                        </p>

                        <p>
                          <span className="font-semibold">
                            Rating:
                          </span>{" "}
                          ⭐{" "}
                          {doctor.rating > 0
                            ? doctor.rating
                            : "New"}

                          {doctor.reviews > 0 &&
                            ` (${doctor.reviews} reviews)`}
                        </p>
                      </div>

                      {/* Booking Button */}

                      <button
  type="button"
  onClick={() => {
    const normalizedDoctor = {
      ...doctor,
      id: doctor.id || doctor._id,
      initials:
        doctor.initials ||
        doctor.name
          ?.replace(/^Dr\.\s*/i, "")
          .split(" ")
          .map((word) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
    };

    onBookDoctor?.(normalizedDoctor);
  }}
  className="mt-5 w-full rounded-xl bg-[#0f2f3f] px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-[#16465d]"
>
  Book Appointment
  <span className="ml-2">→</span>
</button>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Summary */}

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold">
              Summary
            </h3>

            <p className="mt-2 leading-7 text-gray-700">
              {result.summary}
            </p>
          </div>

          {/* Safety */}

          <div className="rounded-2xl border bg-yellow-50 p-6">
            <h3 className="text-lg font-bold">
              Safety Guidance
            </h3>

            <ul className="mt-3 list-disc space-y-2 pl-5">
              {result.safetyGuidance?.map(
                (guidance, index) => (
                  <li key={index}>
                    {guidance}
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Disclaimer */}

          <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
            <strong>Important:</strong>{" "}
            {result.disclaimer}
          </div>

          {/* Stop Speaking */}

          {isSpeaking && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition-all duration-200 hover:bg-red-700"
            >
              🔇 Stop Speaking
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default SymptomAnalyzer;