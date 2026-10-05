require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const maxAttempts = 3;
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set. Add it to the server .env file.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    retryOptions: { attempts: 1 },
  },
});

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
  model,
contents:
  "I suddenly have severe chest pain, difficulty breathing, and feel faint.",

  config: {
  systemInstruction: `
You are the AI symptom analysis assistant for SmartCare, a healthcare
appointment platform.

Your job is to help patients understand which medical specialty may be
appropriate based only on the symptoms they describe.

IMPORTANT SAFETY RULES:

1. Do NOT diagnose diseases or medical conditions.
2. Do NOT claim that the patient has a specific disease.
3. Do NOT recommend, prescribe, or suggest any medication,
   including over-the-counter or prescription medicines.
4. Do NOT provide medication names, dosages, or instructions.
5. Do NOT replace a qualified healthcare professional.
6. You may recommend an appropriate medical specialty.
7. Clearly distinguish between symptoms reported by the patient and
   assumptions.
8. Provide general safety guidance only.
9. Identify emergency warning signs when appropriate.
10. If symptoms indicate a possible emergency, prioritize immediate
    emergency medical care over recommending a medical specialty.
11. For emergency symptoms, provide only general emergency guidance such as
    contacting local emergency services, going to the nearest emergency
    department, or asking someone nearby for help.
12. Do not provide medication recommendations even when discussing
    emergency symptoms.
13. Always include the disclaimer:
    "This is not a medical diagnosis."

Return only the requested JSON structure.
`,

  responseMimeType: "application/json",

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
        "safetyGuidance",
        "disclaimer",
      ],
    },
  },
});

      console.log("Gemini response:");
      const result = JSON.parse(response.text);

console.log("Gemini structured response:");
console.log(JSON.stringify(result, null, 2));
      return;
    } catch (error) {
      const status = error.status || error.statusCode;
      const shouldRetry =
        retryableStatuses.has(status) && attempt < maxAttempts;

      if (!shouldRetry) {
        console.error(`Gemini API request failed (model: ${model}).`);
        console.error(error);
        process.exitCode = 1;
        return;
      }

      const waitMilliseconds = 1000 * 2 ** (attempt - 1);
      console.warn(
        `Gemini returned ${status}; retrying in ${waitMilliseconds / 1000}s ` +
          `(attempt ${attempt + 1}/${maxAttempts}).`,
      );
      await delay(waitMilliseconds);
    }
  }
}

main().catch((error) => {
  console.error("Unexpected error while calling Gemini:");
  console.error(error);
  process.exitCode = 1;
});