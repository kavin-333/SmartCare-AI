const { GoogleGenAI } = require("@google/genai");

function getModel() {
  return process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
}

const maxAttempts = 3;

// ============================================================
// LOCAL DATE PARSER -- fallback when Gemini is unavailable
// ============================================================
function parseLocalDate(speech) {
  if (!speech) return null;
  const s = speech.toLowerCase().trim();
  const now = new Date();

  // "today"
  if (s.indexOf("today") !== -1) return now.toISOString().split("T")[0];

  // "tomorrow"
  if (s.indexOf("tomorrow") !== -1) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  // "next <weekday>"
  const weekdays = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  for (let i = 0; i < weekdays.length; i++) {
    if (s.indexOf("next " + weekdays[i]) !== -1) {
      const d = new Date(now);
      const diff = ((i - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split("T")[0];
    }
  }

  // "<weekday>" (this coming weekday)
  for (let i = 0; i < weekdays.length; i++) {
    if (s.indexOf(weekdays[i]) !== -1) {
      const d = new Date(now);
      const diff = ((i - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split("T")[0];
    }
  }

  // Month name + day  e.g. "March 25", "October 10th"
  const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  for (let mi = 0; mi < months.length; mi++) {
    const idx = s.indexOf(months[mi]);
    if (idx !== -1) {
      const after = s.slice(idx + months[mi].length).trim();
      const dayMatch = after.match(/^(\d{1,2})(?:st|nd|rd|th)?/);
      if (dayMatch) {
        const day = parseInt(dayMatch[1], 10);
        const year = now.getFullYear();
        const dateStr = year + "-" + String(mi + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        const candidate = new Date(dateStr);
        if (candidate < now) candidate.setFullYear(year + 1);
        return candidate.toISOString().split("T")[0];
      }
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmyMatch) {
    return dmyMatch[3] + "-" + dmyMatch[2].padStart(2,"0") + "-" + dmyMatch[1].padStart(2,"0");
  }

  // YYYY-MM-DD
  const isoMatch = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  return null;
}

// ============================================================
// LOCAL TIME PARSER -- fallback when Gemini is unavailable
// ============================================================
function parseLocalTime(speech) {
  if (!speech) return null;
  const s = speech.toLowerCase().trim();

  // HH:mm
  const hhmmMatch = s.match(/(\d{1,2}):(\d{2})/);
  if (hhmmMatch) {
    const h = parseInt(hhmmMatch[1], 10);
    const m = parseInt(hhmmMatch[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0");
    }
  }

  // "3 pm", "10am", "3 p.m."
  const ampmMatch = s.match(/(\d{1,2})\s*([ap])\.?m\.?/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const period = ampmMatch[2];
    if (period === "p" && h !== 12) h += 12;
    if (period === "a" && h === 12) h = 0;
    return String(h).padStart(2,"0") + ":00";
  }

  // "10 in the morning"
  if (s.indexOf("morning") !== -1) {
    const numMatch = s.match(/(\d{1,2})/);
    if (numMatch) {
      let h = parseInt(numMatch[1], 10);
      if (h === 12) h = 0;
      return String(h).padStart(2,"0") + ":00";
    }
  }

  // "3 in the afternoon" / "evening"
  if (s.indexOf("afternoon") !== -1 || s.indexOf("evening") !== -1) {
    const numMatch = s.match(/(\d{1,2})/);
    if (numMatch) {
      let h = parseInt(numMatch[1], 10);
      if (h < 12) h += 12;
      return String(h).padStart(2,"0") + ":00";
    }
  }

  // bare number like "at 4", "at 14", "nine", etc.
  if (s.indexOf("nine") !== -1) return "09:00";
  if (s.indexOf("ten") !== -1) return "10:00";
  if (s.indexOf("eleven") !== -1) return "11:00";
  if (s.indexOf("twelve") !== -1) return "12:00";

  const bareMatch = s.match(/(\d{1,2})/);
  if (bareMatch) {
    const h = parseInt(bareMatch[1], 10);
    if (h >= 0 && h <= 23) {
      const resolved = (h >= 1 && h <= 6) ? h + 12 : h;
      return String(resolved).padStart(2,"0") + ":00";
    }
  }

  return null;
}



const retryableStatuses = new Set([
  429,
  500,
  502,
  503,
  504,
]);

let ai;

function getAI() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY is not set.");
    error.code = "GEMINI_API_KEY_MISSING";
    throw error;
  }

  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        retryOptions: {
          attempts: 3,
        },
      },
    });
  }

  return ai;
}

const delay = (milliseconds) =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

// =========================
// SUPPORTED LANGUAGES
// =========================

const languageNames = {
  "en-IN": "English",
  "ta-IN": "Tamil",
  "hi-IN": "Hindi",
  "te-IN": "Telugu",
  "ml-IN": "Malayalam",
  "kn-IN": "Kannada",
};

// =========================
// ANALYZE SYMPTOMS
// =========================

async function analyzeSymptoms(
  symptomsText,
  language = "en-IN"
) {
  const selectedLanguage =
    languageNames[language] || "English";

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt += 1
  ) {
    try {
      const response =
        await getAI().models.generateContent({
          model: getModel(),

          contents: symptomsText,

          config: {
            systemInstruction: `
You are the AI symptom analysis assistant for SmartCare, a healthcare appointment platform.

The patient selected the language: ${selectedLanguage}.

==================================================
LANGUAGE REQUIREMENTS
==================================================

This is extremely important.

The patient expects the complete AI response in ${selectedLanguage}.

You MUST respond entirely in ${selectedLanguage}.

Every patient-facing human-readable value in the JSON response must be written in ${selectedLanguage}.

This includes:

1. symptoms
2. summary
3. specialty
4. safetyGuidance
5. disclaimer

Do NOT return English translations when the selected language is not English.

Do NOT mix English and ${selectedLanguage} in patient-facing fields.

The safetyGuidance field is especially important because it will be read aloud to the patient using text-to-speech.

Therefore:

EVERY safetyGuidance item MUST be written naturally and completely in ${selectedLanguage}.

The voice response must be understandable to a native speaker of ${selectedLanguage}.

==================================================
SPECIALTY KEY REQUIREMENT
==================================================

The "specialty" field is patient-facing.

Therefore:

- "specialty" MUST be written in ${selectedLanguage}.
- It will be displayed to the patient.
- It must NOT be used as the database lookup value.

The "specialtyKey" field is an INTERNAL DATABASE VALUE.

The "specialtyKey" MUST:

1. Always be written in English.
2. Never be translated.
3. Never contain patient-facing language.
4. Exactly match ONE of these values:

- Cardiologist
- Dermatologist
- General Physician
- Neurologist
- Orthopedist
- Pediatrician

The "specialtyKey" is used by the backend to find matching doctors in MongoDB.

Do NOT translate specialtyKey.

==================================================
SPECIALTY EXAMPLES
==================================================

If the patient language is Tamil:

{
  "specialty": "தோல் மருத்துவம்",
  "specialtyKey": "Dermatologist"
}

If the patient language is Hindi:

{
  "specialty": "त्वचा विशेषज्ञ",
  "specialtyKey": "Dermatologist"
}

If the patient language is Telugu:

{
  "specialty": "చర్మ వైద్య నిపుణుడు",
  "specialtyKey": "Dermatologist"
}

If the patient language is Malayalam:

{
  "specialty": "ത്വക്ക് രോഗ വിദഗ്ധൻ",
  "specialtyKey": "Dermatologist"
}

If the patient language is Kannada:

{
  "specialty": "ಚರ್ಮರೋಗ ತಜ್ಞರು",
  "specialtyKey": "Dermatologist"
}

If the patient language is English:

{
  "specialty": "Dermatology",
  "specialtyKey": "Dermatologist"
}

The patient should see and hear the localized "specialty".

The backend should use only "specialtyKey" for doctor matching.

==================================================
SPECIALTY SELECTION
==================================================

Choose the most appropriate medical specialty based on the symptoms reported by the patient.

Use ONLY one of these specialtyKey values:

Cardiologist
Dermatologist
General Physician
Neurologist
Orthopedist
Pediatrician

Examples:

Heart-related symptoms:
specialtyKey = "Cardiologist"

Skin-related symptoms:
specialtyKey = "Dermatologist"

General symptoms that do not clearly belong to another specialty:
specialtyKey = "General Physician"

Neurological symptoms:
specialtyKey = "Neurologist"

Bone, joint, muscle, or orthopedic symptoms:
specialtyKey = "Orthopedist"

Symptoms involving children:
specialtyKey = "Pediatrician"

==================================================
LANGUAGE EXAMPLES
==================================================

If the selected language is Tamil:

Respond in Tamil.

Example:

{
  "symptoms": [
    "தோலில் தடிப்பு",
    "அரிப்பு"
  ],
  "summary": "நீங்கள் தோலில் தடிப்பு மற்றும் அரிப்பு இருப்பதாக தெரிவித்துள்ளீர்கள்.",
  "specialty": "தோல் மருத்துவம்",
  "specialtyKey": "Dermatologist",
  "safetyGuidance": [
    "பாதிக்கப்பட்ட பகுதியை சொறிவதைத் தவிர்க்கவும்.",
    "அறிகுறிகள் மோசமடைந்தால் மருத்துவரை அணுகவும்."
  ],
  "disclaimer": "இது மருத்துவ நோயறிதல் அல்ல."
}

If the selected language is Hindi:

Respond in Hindi.

If the selected language is Telugu:

Respond in Telugu.

If the selected language is Malayalam:

Respond in Malayalam.

If the selected language is Kannada:

Respond in Kannada.

If the selected language is English:

Respond in English.

==================================================
MEDICAL SAFETY RULES
==================================================

1. Do NOT diagnose diseases or medical conditions.

2. Do NOT claim that the patient has a specific disease.

3. Do NOT recommend, prescribe, or suggest any medication, including over-the-counter or prescription medicines.

4. Do NOT provide medication names, dosages, or instructions.

5. Do NOT replace a qualified healthcare professional.

6. You may recommend an appropriate medical specialty.

7. Clearly distinguish between symptoms reported by the patient and assumptions.

8. Provide general safety guidance only.

9. Identify emergency warning signs when appropriate.

10. If symptoms indicate a possible emergency, prioritize immediate emergency medical care over recommending a medical specialty.

11. For emergency symptoms, provide only general emergency guidance such as:

- contacting local emergency services
- going to the nearest emergency department
- asking someone nearby for help

12. Do NOT provide medication recommendations even when discussing emergency symptoms.

13. Never provide a diagnosis.

14. Always include a medical disclaimer.

15. The medical disclaimer MUST also be written in ${selectedLanguage}.

The disclaimer must communicate the meaning:

"This is not a medical diagnosis."

==================================================
SAFETY GUIDANCE VOICE REQUIREMENT
==================================================

The safetyGuidance array will be sent directly to a text-to-speech system.

Therefore:

- Use natural conversational language.
- Keep each safety guidance item clear and concise.
- Do not include English translations.
- Do not include pronunciation instructions.
- Do not include language names.
- Do not include unnecessary technical terminology.
- Do not include markdown.
- Do not include emojis.
- Do not include medication recommendations.

If the patient has emergency symptoms, the safetyGuidance must clearly communicate the need for immediate emergency medical care in ${selectedLanguage}.

==================================================
OUTPUT REQUIREMENT
==================================================

Return ONLY the requested JSON structure.

Do not add explanations outside the JSON.

IMPORTANT:

The "specialtyKey" is the ONLY field that is allowed to contain
English when the selected language is not English.

The specialtyKey is an internal technical/database value and
must NOT be translated.

All other text must be in ${selectedLanguage}.
`,

            responseMimeType:
              "application/json",

            responseSchema: {
              type: "object",

              properties: {
                symptoms: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },

                summary: {
                  type: "string",
                },

                specialty: {
                  type: "string",
                },

                specialtyKey: {
                  type: "string",
                  enum: [
                    "Cardiologist",
                    "Dermatologist",
                    "General Physician",
                    "Neurologist",
                    "Orthopedist",
                    "Pediatrician",
                  ],
                },

                safetyGuidance: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },

                disclaimer: {
                  type: "string",
                },
              },

              required: [
                "symptoms",
                "summary",
                "specialty",
                "specialtyKey",
                "safetyGuidance",
                "disclaimer",
              ],
            },
          },
        });

      const result = JSON.parse(
        response.text
      );

      return result;
    } catch (error) {
      const status =
        error.status || error.statusCode;

      const shouldRetry =
        retryableStatuses.has(status) &&
        attempt < maxAttempts;

      if (!shouldRetry) {
        throw error;
      }

      const waitMilliseconds =
        1000 * 2 ** (attempt - 1);

      console.warn(
        `Gemini returned ${status}; retrying in ` +
          `${waitMilliseconds / 1000}s ` +
          `(attempt ${attempt + 1}/${maxAttempts}).`
      );

      await delay(waitMilliseconds);
    }
  }
}
// ============================================================
// Analyze Voice Appointment Intent
// ============================================================
async function analyzeVoiceIntent(patientSpeech) {
  if (!patientSpeech || !patientSpeech.trim()) {
    return {
      intent: "UNKNOWN",
      confidence: 0,
    };
  }

  const cleanSpeech = String(patientSpeech).toLowerCase().trim();

  // Fast-path instant intent matching (resilient against network drops)
  if (cleanSpeech.includes("confirm") || cleanSpeech.includes("yes") || cleanSpeech.includes("sure") || cleanSpeech.includes("okay") || cleanSpeech.includes("attend")) {
    if (!cleanSpeech.includes("cancel") && !cleanSpeech.includes("reschedule") && !cleanSpeech.includes("change")) {
      return { intent: "CONFIRM", confidence: 0.99 };
    }
  }
  if (cleanSpeech.includes("cancel") || cleanSpeech.includes("cannot attend") || cleanSpeech.includes("don't want") || cleanSpeech.includes("dont want")) {
    return { intent: "CANCEL", confidence: 0.99 };
  }
  if (cleanSpeech.includes("reschedule") || cleanSpeech.includes("postpone") || cleanSpeech.includes("another time") || cleanSpeech.includes("change")) {
    return { intent: "RESCHEDULE", confidence: 0.99 };
  }

  const prompt = `
You are a voice assistant for SmartCare, a healthcare appointment platform.

Your ONLY job is to understand the patient's intention regarding
their existing appointment.

The patient may say things like:

CONFIRM:
- "Yes"
- "Yes, confirm it"
- "I will attend"
- "Keep my appointment"
- "I want to confirm"

CANCEL:
- "Cancel it"
- "I don't want the appointment"
- "Cancel my appointment"
- "I cannot attend"

RESCHEDULE:
- "I want to reschedule"
- "Can you change the appointment?"
- "I need another time"
- "Move it to tomorrow"

UNKNOWN:
- Anything that does not clearly indicate confirmation,
  cancellation, or rescheduling.

Patient's speech:
"${patientSpeech}"

Return ONLY valid JSON in exactly this format:

{
  "intent": "CONFIRM",
  "confidence": 0.95
}

Allowed intent values:
- CONFIRM
- CANCEL
- RESCHEDULE
- UNKNOWN

Do not provide medical advice.
Do not diagnose the patient.
Do not recommend medications.
`;

  try {
    const result = await getAI().models.generateContent({
      model: getModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: [
                "CONFIRM",
                "CANCEL",
                "RESCHEDULE",
                "UNKNOWN",
              ],
            },
            confidence: {
              type: "number",
            },
          },
          required: ["intent", "confidence"],
        },
      },
    });

    const text = result.text;

    console.log("Gemini voice intent response:");
    console.log(text);

    const parsed = JSON.parse(text);

    return {
      intent: parsed.intent || "UNKNOWN",
      confidence: parsed.confidence ?? 0,
    };
  } catch (error) {
    console.error(
      "Gemini voice intent analysis error:",
      error
    );

    return {
      intent: "UNKNOWN",
      confidence: 0,
    };
  }
}
// ============================================================
// Extract Reschedule Date
// ============================================================
async function extractRescheduleDate(patientSpeech) {
  if (!patientSpeech || !patientSpeech.trim()) {
    return {
      date: null,
    };
  }

  const prompt = `
You are a date extraction assistant for SmartCare,
a healthcare appointment platform.

The patient is trying to reschedule an appointment.

Today's date is ${new Date().toISOString().split("T")[0]}.

Extract the date the patient wants for their new appointment.

Examples:

Patient:
"March 25"
Return:
{
  "date": "2027-03-25"
}

Patient:
"Tomorrow"
Return the correct date based on today's date.

Patient:
"Next Monday"
Return the correct date based on today's date.

Patient:
"I want it on April 10th"
Return:
{
  "date": "2027-04-10"
}

If no clear date is provided, return:

{
  "date": null
}

Return ONLY valid JSON.

Patient speech:
"${patientSpeech}"

Format:

{
  "date": "YYYY-MM-DD"
}
`;

    // Always try local parsing first — fast and network-independent
  const localDate = parseLocalDate(patientSpeech);
  if (localDate) {
    console.log("Local date parsed:", localDate);
    return { date: localDate };
  }

  try {
    const result = await getAI().models.generateContent({
      model: getModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            date: {
              type: ["string", "null"],
            },
          },
          required: ["date"],
        },
      },
    });

    const text = result.text;

    console.log("Gemini date extraction:");
    console.log(text);

    const parsed = JSON.parse(text);

    return {
      date: parsed.date || null,
    };
  } catch (error) {
    console.error(
      "Gemini reschedule date extraction error:",
      error
    );

    return {
      date: null,
    };
  }
}
// ============================================================
// Extract Reschedule Time
// ============================================================
async function extractRescheduleTime(patientSpeech) {
  if (!patientSpeech || !patientSpeech.trim()) {
    return {
      time: null,
    };
  }

  const prompt = `
You are a time extraction assistant for SmartCare,
a healthcare appointment platform.

The patient is trying to reschedule an appointment.

Extract the appointment time they want.

Convert the time into 24-hour HH:mm format.

Examples:

Patient:
"3 PM"

Return:
{
  "time": "15:00"
}

Patient:
"10 in the morning"

Return:
{
  "time": "10:00"
}

Patient:
"2:30 PM"

Return:
{
  "time": "14:30"
}

Patient:
"at 4"

Return:
{
  "time": "16:00"
}

Patient:
"I want the 11 AM slot"

Return:
{
  "time": "11:00"
}

If the patient does not provide a clear time, return:

{
  "time": null
}

Return ONLY valid JSON.

Patient speech:
"${patientSpeech}"

Format:

{
  "time": "HH:mm"
}
`;

    // Always try local parsing first — fast and network-independent
  const localTime = parseLocalTime(patientSpeech);
  if (localTime) {
    console.log("Local time parsed:", localTime);
    return { time: localTime };
  }

  try {
    const result = await getAI().models.generateContent({
      model: getModel(),
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            time: {
              type: ["string", "null"],
            },
          },
          required: ["time"],
        },
      },
    });

    const text = result.text;

    console.log("Gemini time extraction:");
    console.log(text);

    const parsed = JSON.parse(text);

    return {
      time: parsed.time || null,
    };
  } catch (error) {
    console.error(
      "Gemini reschedule time extraction error:",
      error
    );

    return {
      time: null,
    };
  }
}
module.exports = {
  analyzeSymptoms,
  analyzeVoiceIntent,
  extractRescheduleDate,
  extractRescheduleTime,
};
