const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// =====================================================
// TWILIO BODY PARSER
// =====================================================

// Twilio sends Voice webhook data as
// application/x-www-form-urlencoded
router.use(
  express.urlencoded({
    extended: false,
  })
);

// =====================================================
// SERVICES
// =====================================================

const {
  makeTestCall,
  makeAppointmentCall,
} = require("../services/twilioService");

const {
  analyzeVoiceIntent,
  extractRescheduleDate,
  extractRescheduleTime,
} = require("../services/geminiService");

// =====================================================
// MIDDLEWARE
// =====================================================

const authenticateToken = require("../middleware/authMiddleware");

// =====================================================
// MODELS
// =====================================================

const Patient = require("../models/Patient");
const Appointment = require("../models/Appointment");

// =====================================================
// TWILIO
// =====================================================

const VoiceResponse =
  require("twilio").twiml.VoiceResponse;

// =====================================================
// CONFIGURATION
// =====================================================

const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || ""
).replace(/\/+$/, "");

const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00",
];

const SUPPORTED_LANGUAGES = [
  "en-IN",
  "ta-IN",
  "hi-IN",
  "te-IN",
  "ml-IN",
  "kn-IN",
];

// =====================================================
// MULTILINGUAL TEXT
// =====================================================

const LANGUAGE_TEXT = {
  "en-IN": {
    greeting:
      "Hello. This is SmartCare AI. We are calling about your medical appointment.",

    appointment:
      "You have an appointment with",

    appointmentAt:
      "on",

    confirm:
      "Please say confirm, cancel, or reschedule.",

    confirmed:
      "Your appointment has been confirmed. Thank you.",

    cancelled:
      "Your appointment has been cancelled successfully.",

    reschedule:
      "Sure. Please tell me the new appointment date.",

    askTime:
      "Thank you. Now please tell me the preferred time.",

    invalidDate:
      "I could not understand the date. Please say the date again.",

    invalidTime:
      "I could not understand the time. Please say the time again.",

    unavailableTime:
      "That time is not available. Please choose another available time.",

    successfulReschedule:
      "Your appointment has been rescheduled successfully.",

    unknown:
      "Sorry, I could not understand your response. Please say confirm, cancel, or reschedule.",

    goodbye:
      "Thank you for using SmartCare AI. Goodbye.",
  },

  "ta-IN": {
    greeting:
      "வணக்கம். இது SmartCare AI. உங்கள் மருத்துவ சந்திப்பு குறித்து பேசுகிறோம்.",

    appointment:
      "உங்களுக்கு சந்திப்பு உள்ளது",

    appointmentAt:
      "தேதியில்",

    confirm:
      "உறுதிப்படுத்த, ரத்து செய்ய அல்லது மாற்றியமைக்க சொல்லுங்கள்.",

    confirmed:
      "உங்கள் சந்திப்பு உறுதிப்படுத்தப்பட்டது. நன்றி.",

    cancelled:
      "உங்கள் சந்திப்பு வெற்றிகரமாக ரத்து செய்யப்பட்டது.",

    reschedule:
      "சரி. புதிய சந்திப்பு தேதியை சொல்லுங்கள்.",

    askTime:
      "நன்றி. இப்போது விரும்பும் நேரத்தை சொல்லுங்கள்.",

    invalidDate:
      "தேதியை புரிந்துகொள்ள முடியவில்லை. மீண்டும் சொல்லுங்கள்.",

    invalidTime:
      "நேரத்தை புரிந்துகொள்ள முடியவில்லை. மீண்டும் சொல்லுங்கள்.",

    unavailableTime:
      "அந்த நேரம் கிடைக்கவில்லை. வேறு நேரத்தை தேர்வு செய்யுங்கள்.",

    successfulReschedule:
      "உங்கள் சந்திப்பு வெற்றிகரமாக மாற்றியமைக்கப்பட்டது.",

    unknown:
      "உங்கள் பதிலை புரிந்துகொள்ள முடியவில்லை. உறுதிப்படுத்த, ரத்து செய்ய அல்லது மாற்றியமைக்க சொல்லுங்கள்.",

    goodbye:
      "SmartCare AI பயன்படுத்தியதற்கு நன்றி. வணக்கம்.",
  },

  "hi-IN": {
    greeting:
      "नमस्ते। यह SmartCare AI है। हम आपकी मेडिकल अपॉइंटमेंट के बारे में बात कर रहे हैं।",

    appointment:
      "आपकी अपॉइंटमेंट है",

    appointmentAt:
      "को",

    confirm:
      "कृपया पुष्टि, रद्द या पुनर्निर्धारित कहें।",

    confirmed:
      "आपकी अपॉइंटमेंट की पुष्टि हो गई है। धन्यवाद।",

    cancelled:
      "आपकी अपॉइंटमेंट सफलतापूर्वक रद्द कर दी गई है।",

    reschedule:
      "ठीक है। कृपया नई अपॉइंटमेंट की तारीख बताएं।",

    askTime:
      "धन्यवाद। अब पसंदीदा समय बताएं।",

    invalidDate:
      "मैं तारीख समझ नहीं पाया। कृपया दोबारा बताएं।",

    invalidTime:
      "मैं समय समझ नहीं पाया। कृपया दोबारा बताएं।",

    unavailableTime:
      "यह समय उपलब्ध नहीं है। कृपया दूसरा समय चुनें।",

    successfulReschedule:
      "आपकी अपॉइंटमेंट सफलतापूर्वक पुनर्निर्धारित कर दी गई है।",

    unknown:
      "मैं आपका जवाब समझ नहीं पाया। कृपया पुष्टि, रद्द या पुनर्निर्धारित कहें।",

    goodbye:
      "SmartCare AI का उपयोग करने के लिए धन्यवाद। नमस्ते।",
  },

  "te-IN": {
    greeting:
      "నమస్కారం. ఇది SmartCare AI. మీ వైద్య అపాయింట్‌మెంట్ గురించి మాట్లాడుతున్నాము.",

    appointment:
      "మీకు అపాయింట్‌మెంట్ ఉంది",

    appointmentAt:
      "తేదీన",

    confirm:
      "నిర్ధారించడానికి, రద్దు చేయడానికి లేదా మార్చడానికి చెప్పండి.",

    confirmed:
      "మీ అపాయింట్‌మెంట్ నిర్ధారించబడింది. ధన్యవాదాలు.",

    cancelled:
      "మీ అపాయింట్‌మెంట్ విజయవంతంగా రద్దు చేయబడింది.",

    reschedule:
      "సరే. కొత్త అపాయింట్‌మెంట్ తేదీని చెప్పండి.",

    askTime:
      "ధన్యవాదాలు. ఇప్పుడు కావలసిన సమయాన్ని చెప్పండి.",

    invalidDate:
      "తేదీ అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.",

    invalidTime:
      "సమయం అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.",

    unavailableTime:
      "ఆ సమయం అందుబాటులో లేదు. మరో సమయాన్ని ఎంచుకోండి.",

    successfulReschedule:
      "మీ అపాయింట్‌మెంట్ విజయవంతంగా మార్చబడింది.",

    unknown:
      "మీ సమాధానం అర్థం కాలేదు. నిర్ధారించడానికి, రద్దు చేయడానికి లేదా మార్చడానికి చెప్పండి.",

    goodbye:
      "SmartCare AI ఉపయోగించినందుకు ధన్యవాదాలు. నమస్కారం.",
  },

  "ml-IN": {
    greeting:
      "നമസ്കാരം. ഇത് SmartCare AI ആണ്. നിങ്ങളുടെ മെഡിക്കൽ അപ്പോയിന്റ്മെന്റിനെക്കുറിച്ച് സംസാരിക്കുകയാണ്.",

    appointment:
      "നിങ്ങൾക്ക് അപ്പോയിന്റ്മെന്റ് ഉണ്ട്",

    appointmentAt:
      "തീയതിയിൽ",

    confirm:
      "സ്ഥിരീകരിക്കുക, റദ്ദാക്കുക അല്ലെങ്കിൽ മാറ്റിവയ്ക്കുക എന്ന് പറയുക.",

    confirmed:
      "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിച്ചു. നന്ദി.",

    cancelled:
      "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് വിജയകരമായി റദ്ദാക്കി.",

    reschedule:
      "ശരി. പുതിയ അപ്പോയിന്റ്മെന്റ് തീയതി പറയൂ.",

    askTime:
      "നന്ദി. ഇപ്പോൾ നിങ്ങൾക്ക് വേണ്ട സമയം പറയൂ.",

    invalidDate:
      "തീയതി മനസ്സിലായില്ല. വീണ്ടും പറയൂ.",

    invalidTime:
      "സമയം മനസ്സിലായില്ല. വീണ്ടും പറയൂ.",

    unavailableTime:
      "ആ സമയം ലഭ്യമല്ല. മറ്റൊരു സമയം തിരഞ്ഞെടുക്കൂ.",

    successfulReschedule:
      "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് വിജയകരമായി മാറ്റി.",

    unknown:
      "നിങ്ങളുടെ മറുപടി മനസ്സിലായില്ല. സ്ഥിരീകരിക്കുക, റദ്ദാക്കുക അല്ലെങ്കിൽ മാറ്റിവയ്ക്കുക എന്ന് പറയൂ.",

    goodbye:
      "SmartCare AI ഉപയോഗിച്ചതിന് നന്ദി. നമസ്കാരം.",
  },

  "kn-IN": {
    greeting:
      "ನಮಸ್ಕಾರ. ಇದು SmartCare AI. ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬಗ್ಗೆ ಮಾತನಾಡುತ್ತಿದ್ದೇವೆ.",

    appointment:
      "ನಿಮಗೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಇದೆ",

    appointmentAt:
      "ದಿನಾಂಕದಂದು",

    confirm:
      "ದೃಢೀಕರಿಸಲು, ರದ್ದುಪಡಿಸಲು ಅಥವಾ ಮರುನಿಗದಿಪಡಿಸಲು ಹೇಳಿ.",

    confirmed:
      "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು.",

    cancelled:
      "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಯಶಸ್ವಿಯಾಗಿ ರದ್ದುಗೊಂಡಿದೆ.",

    reschedule:
      "ಸರಿ. ಹೊಸ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ದಿನಾಂಕವನ್ನು ಹೇಳಿ.",

    askTime:
      "ಧನ್ಯವಾದಗಳು. ಈಗ ನಿಮಗೆ ಬೇಕಾದ ಸಮಯವನ್ನು ಹೇಳಿ.",

    invalidDate:
      "ದಿನಾಂಕ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.",

    invalidTime:
      "ಸಮಯ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.",

    unavailableTime:
      "ಆ ಸಮಯ ಲಭ್ಯವಿಲ್ಲ. ಬೇರೆ ಸಮಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",

    successfulReschedule:
      "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಯಶಸ್ವಿಯಾಗಿ ಮರುನಿಗದಿಪಡಿಸಲಾಗಿದೆ.",

    unknown:
      "ನಿಮ್ಮ ಉತ್ತರ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದೃಢೀಕರಿಸಲು, ರದ್ದುಪಡಿಸಲು ಅಥವಾ ಮರುನಿಗದಿಪಡಿಸಲು ಹೇಳಿ.",

    goodbye:
      "SmartCare AI ಬಳಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಮಸ್ಕಾರ.",
  },
};

// =====================================================
// LANGUAGE HELPERS
// =====================================================

function getLanguage(appointment) {
  const language =
    appointment?.voiceLanguage || "en-IN";

  if (SUPPORTED_LANGUAGES.includes(language)) {
    return language;
  }

  return "en-IN";
}

function getText(appointment) {
  const language = getLanguage(appointment);

  return (
    LANGUAGE_TEXT[language] ||
    LANGUAGE_TEXT["en-IN"]
  );
}

// =====================================================
// SPEECH GATHER HELPER
// =====================================================

function addSpeechGather(
  response,
  appointmentId,
  appointment,
  prompt
) {
  if (!PUBLIC_BASE_URL) {
    throw new Error(
      "PUBLIC_BASE_URL is not configured."
    );
  }

  const language = getLanguage(appointment);

  const action =
    `${PUBLIC_BASE_URL}/api/voice/handle-response` +
    `?appointmentId=${encodeURIComponent(
      appointmentId
    )}`;

  const gather = response.gather({
    input: "speech",
    action,
    method: "POST",
    language,
    speechTimeout: "auto",
    timeout: 5,
    actionOnEmptyResult: true,
  });

  gather.say(
    {
      language,
    },
    prompt
  );

  return gather;
}

// =====================================================
// TEST CALL
// POST /api/voice/test
// =====================================================

router.post(
  "/test",
  async (req, res) => {
    try {
      const {
        phoneNumber,
      } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({
          message:
            "phoneNumber is required.",
        });
      }

      const call =
        await makeTestCall(
          phoneNumber
        );

      return res.json({
        message:
          "Test call initiated successfully.",
        callSid: call.sid,
        status: call.status,
      });
    } catch (error) {
      console.error(
        "Test call error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to initiate test call.",
        error: error.message,
      });
    }
  }
);

// =====================================================
// INCOMING SMARTCARE VOICE CALL
// POST /api/voice/incoming
// =====================================================

router.post(
  "/incoming",
  async (req, res) => {
    try {
      console.log(
        "========================================"
      );

      console.log(
        "Incoming SmartCare Voice Call"
      );

      console.log(
        "Content-Type:",
        req.headers["content-type"]
      );

      console.log(
        "Body:",
        req.body
      );

      console.log(
        "From:",
        req.body.From
      );

      console.log(
        "========================================"
      );

      const callerPhone =
        req.body.From;

      const response =
        new VoiceResponse();

      if (!callerPhone) {
        response.say(
          "Sorry, we could not identify your phone number. Goodbye."
        );

        response.hangup();

        res.type("text/xml");

        return res.send(
          response.toString()
        );
      }

      const normalizedPhone =
        String(callerPhone)
          .replace(/[\s()-]/g, "")
          .trim();

      console.log(
        "Normalized caller:",
        normalizedPhone
      );

      const patient =
        await Patient.findOne({
          phoneNumber:
            normalizedPhone,
        });

      if (!patient) {
        console.log(
          "No patient found:",
          normalizedPhone
        );

        response.say(
          "Sorry, we could not find a SmartCare account associated with this phone number."
        );

        response.hangup();

        res.type("text/xml");

        return res.send(
          response.toString()
        );
      }

      console.log(
        "Patient found:",
        patient.name
      );

      const appointment =
        await Appointment.findOne({
          patient: patient._id,
          status: {
            $in: [
              "Booked",
              "Confirmed",
            ],
          },
        })
          .sort({
            appointmentDate: 1,
            appointmentTime: 1,
          })
          .populate("patient")
          .populate("doctor");

      if (!appointment) {
        console.log(
          "No active appointment found for:",
          patient._id.toString()
        );

        response.say(
          `Hello ${patient.name}. We could not find an active appointment associated with your account. Goodbye.`
        );

        response.hangup();

        res.type("text/xml");

        return res.send(
          response.toString()
        );
      }

      console.log(
        "Appointment found:",
        appointment._id.toString()
      );

      appointment.voiceConversation = {
        active: true,
        step: "NONE",
        requestedDate: null,
        requestedTime: null,
        attempts: 0,
      };

      await appointment.save();

      const language =
        getLanguage(appointment);

      const patientName =
        patient.name || "Patient";

      const doctorName =
        appointment.doctor?.name ||
        "your doctor";

      const appointmentDate =
        appointment.appointmentDate || "";

      const appointmentTime =
        appointment.appointmentTime || "";

      const greeting =
        `Hello ${patientName}. ` +
        `This is SmartCare AI. ` +
        `You have an appointment with ${doctorName} ` +
        `on ${appointmentDate} at ${appointmentTime}. ` +
        `Would you like to confirm, cancel, or reschedule this appointment?`;

      addSpeechGather(
        response,
        appointment._id.toString(),
        appointment,
        greeting
      );

      response.say(
        {
          language,
        },
        "Sorry, I did not hear a response. Goodbye."
      );

      response.hangup();

      res.type("text/xml");

      return res.send(
        response.toString()
      );
    } catch (error) {
      console.error(
        "Incoming voice call error:",
        error
      );

      const response =
        new VoiceResponse();

      response.say(
        "Sorry, SmartCare is temporarily unavailable. Please try again later."
      );

      response.hangup();

      res.type("text/xml");

      return res.send(
        response.toString()
      );
    }
  }
);
// =====================================================
// APPOINTMENT CALL
// POST /api/voice/appointment-call
// =====================================================

router.post(
  "/appointment-call",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        appointmentId,
      } = req.body;

      // -------------------------------------------------
      // Validate appointment ID
      // -------------------------------------------------

      if (!appointmentId) {
        return res.status(400).json({
          message:
            "appointmentId is required.",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          appointmentId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid appointment ID.",
        });
      }

      // -------------------------------------------------
      // Find appointment
      // -------------------------------------------------

      const appointment =
        await Appointment.findById(
          appointmentId
        );

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found.",
        });
      }

      // -------------------------------------------------
      // Verify ownership
      // -------------------------------------------------

      if (
        appointment.patient.toString() !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            "You cannot initiate a call for this appointment.",
        });
      }

      // -------------------------------------------------
      // Prevent calls for cancelled appointments
      // -------------------------------------------------

      if (
        appointment.status ===
        "Cancelled"
      ) {
        return res.status(400).json({
          message:
            "Cannot call for a cancelled appointment.",
        });
      }

      // -------------------------------------------------
      // Initiate appointment call
      // -------------------------------------------------

      const call =
        await makeAppointmentCall(
          appointment.phoneNumber,
          appointment._id.toString()
        );

      // -------------------------------------------------
      // Save call information
      // -------------------------------------------------

      appointment.voiceCall = {
        sid: call.sid,
        status: call.status,
        lastAttemptAt: new Date(),
      };

      await appointment.save();

      // -------------------------------------------------
      // Response
      // -------------------------------------------------

      return res.json({
        message:
          "Appointment voice call initiated.",
        callSid: call.sid,
        status: call.status,
      });
    } catch (error) {
      console.error(
        "Appointment call error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to initiate appointment call.",
        error: error.message,
      });
    }
  }
);

// =====================================================
// TEST APPOINTMENT CALL
// POST /api/voice/test-appointment-call
//
// TESTING ONLY
//
// Postman body:
//
// {
//   "appointmentId": "YOUR_APPOINTMENT_ID",
//   "phoneNumber": "+918778900422"
// }
//
// This endpoint does NOT require JWT authentication.
// It allows us to test an appointment call using the
// appointment ID and phone number supplied in Postman.
// =====================================================

router.post(
  "/test-appointment-call",
  async (req, res) => {
    try {
      const {
        appointmentId,
        phoneNumber,
      } = req.body;

      // -------------------------------------------------
      // Validate appointment ID
      // -------------------------------------------------

      if (!appointmentId) {
        return res.status(400).json({
          message:
            "appointmentId is required.",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          appointmentId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid appointment ID.",
        });
      }

      // -------------------------------------------------
      // Normalize phone number
      // -------------------------------------------------

      const normalizedPhoneNumber =
        String(phoneNumber || "")
          .replace(/[\s()-]/g, "")
          .trim();

      // -------------------------------------------------
      // Validate phone number
      // -------------------------------------------------

      if (
        !/^\+[1-9]\d{7,14}$/.test(
          normalizedPhoneNumber
        )
      ) {
        return res.status(400).json({
          message:
            "Please provide a valid phone number with country code.",
        });
      }

      // -------------------------------------------------
      // Find appointment
      // -------------------------------------------------

      const appointment =
        await Appointment.findById(
          appointmentId
        );

      if (!appointment) {
        return res.status(404).json({
          message:
            "Appointment not found.",
        });
      }

      // -------------------------------------------------
      // Prevent cancelled appointment calls
      // -------------------------------------------------

      if (
        appointment.status ===
        "Cancelled"
      ) {
        return res.status(400).json({
          message:
            "Cannot initiate a call for a cancelled appointment.",
        });
      }

      // -------------------------------------------------
      // Log test request
      // -------------------------------------------------

      console.log(
        "========================================"
      );

      console.log(
        "TEST APPOINTMENT CALL REQUEST"
      );

      console.log(
        "Appointment ID:",
        appointmentId
      );

      console.log(
        "Phone Number:",
        normalizedPhoneNumber
      );

      console.log(
        "========================================"
      );

      // -------------------------------------------------
      // Make Twilio appointment call
      // -------------------------------------------------

      const call =
        await makeAppointmentCall(
          normalizedPhoneNumber,
          appointmentId
        );

      // -------------------------------------------------
      // Save call information
      // -------------------------------------------------

      appointment.voiceCall = {
        sid: call.sid,
        status: call.status,
        lastAttemptAt: new Date(),
      };

      await appointment.save();

      // -------------------------------------------------
      // Return result
      // -------------------------------------------------

      return res.status(200).json({
        message:
          "SmartCare AI appointment call initiated.",

        appointmentId,

        phoneNumber:
          normalizedPhoneNumber,

        callSid:
          call.sid,

        status:
          call.status,
      });
    } catch (error) {
      console.error(
        "Test appointment call error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to initiate SmartCare AI appointment call.",

        error:
          error.message,
      });
    }
  }
);

// =====================================================
// INITIAL TWIML
// POST /api/voice/twiml
// =====================================================

router.post(
  "/twiml",
  async (req, res) => {
    try {
      const {
        appointmentId,
      } = req.query;

      // -------------------------------------------------
      // Validate appointment ID
      // -------------------------------------------------

      if (!appointmentId) {
        return res.status(400).send(
          "Missing appointmentId"
        );
      }

      if (
        !mongoose.Types.ObjectId.isValid(
          appointmentId
        )
      ) {
        return res.status(400).send(
          "Invalid appointmentId"
        );
      }

      // -------------------------------------------------
      // Find appointment
      // -------------------------------------------------

      const appointment =
        await Appointment.findById(
          appointmentId
        )
          .populate(
            "patient",
            "name email"
          )
          .populate(
            "doctor",
            "name specialization hospital"
          );

      if (!appointment) {
        return res.status(404).send(
          "Appointment not found"
        );
      }

      const response =
        new VoiceResponse();

      const language =
        getLanguage(appointment);

      const text =
        getText(appointment);

      // -------------------------------------------------
      // Cancelled appointment
      // -------------------------------------------------

      if (
        appointment.status ===
        "Cancelled"
      ) {
        response.say(
          {
            language,
          },
          "This appointment has already been cancelled."
        );

        response.hangup();

        return res
          .type("text/xml")
          .send(
            response.toString()
          );
      }

      // -------------------------------------------------
      // Appointment information
      // -------------------------------------------------

      const patientName =
        appointment.patient?.name ||
        "Patient";

      const doctorName =
        appointment.doctor?.name ||
        "your doctor";

      const specialization =
        appointment.doctor?.specialization ||
        "";

      const date =
        appointment.appointmentDate;

      const time =
        appointment.appointmentTime;

      // -------------------------------------------------
      // Greeting
      // -------------------------------------------------

      response.say(
        {
          language,
        },
        `${text.greeting} ${patientName}.`
      );

      // -------------------------------------------------
      // Appointment details
      // -------------------------------------------------

      response.say(
        {
          language,
        },
        `${text.appointment} ${doctorName}, ${specialization}, ${text.appointmentAt} ${date} at ${time}.`
      );

      // -------------------------------------------------
      // Ask for action
      // -------------------------------------------------

      addSpeechGather(
        response,
        appointmentId,
        appointment,
        text.confirm
      );

      // -------------------------------------------------
      // Fallback
      // -------------------------------------------------

      response.say(
        {
          language,
        },
        "I did not receive a response."
      );

      response.hangup();

      return res
        .type("text/xml")
        .send(
          response.toString()
        );
    } catch (error) {
      console.error(
        "Initial TwiML error:",
        error
      );

      return res.status(500).send(
        "Unable to generate TwiML."
      );
    }
  }
);