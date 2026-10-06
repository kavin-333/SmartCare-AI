const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Twilio sends application/x-www-form-urlencoded, Postman may send application/json
router.use(express.urlencoded({ extended: false }));
router.use(express.json());

const { makeTestCall, makeAppointmentCall } = require("../services/twilioService");
const { analyzeVoiceIntent, extractRescheduleDate, extractRescheduleTime } = require("../services/geminiService");
const authenticateToken = require("../middleware/authMiddleware");
const Appointment = require("../models/Appointment");
const VoiceResponse = require("twilio").twiml.VoiceResponse;

function getPublicBaseUrl(req) {
  const envUrl = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (envUrl && !envUrl.includes("ngrok-free.dev") && !envUrl.includes("ngrok.io")) {
    return envUrl;
  }
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) return `${proto}://${host}`;
  }
  return "https://smart-care-ai-a33e.vercel.app";
}

const TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
const SUPPORTED_LANGUAGES = ["en-IN", "ta-IN", "hi-IN", "te-IN", "ml-IN", "kn-IN"];

const LANGUAGE_TEXT = {
  "en-IN": {
    greeting: "Hello. This is SmartCare AI. We are calling about your medical appointment.",
    appointment: "You have an appointment with",
    appointmentAt: "on",
    confirm: "Please say confirm, cancel, or reschedule.",
    confirmed: "Your appointment has been confirmed. Thank you.",
    cancelled: "Your appointment has been cancelled successfully.",
    reschedule: "Sure. Please tell me the new appointment date.",
    askTime: "Thank you. Now please tell me the preferred time.",
    invalidDate: "I could not understand the date. Please say the date again.",
    invalidTime: "I could not understand the time. Please say the time again.",
    unavailableTime: "That time is not available. Please choose another available time.",
    successfulReschedule: "Your appointment has been rescheduled successfully.",
    unknown: "Sorry, I could not understand your response. Please say confirm, cancel, or reschedule.",
    goodbye: "Thank you for using SmartCare AI. Goodbye.",
  },
  "ta-IN": {
    greeting: "வணக்கம். இது SmartCare AI. உங்கள் மருத்துவ சந்திப்பு குறித்து பேசுகிறோம்.",
    appointment: "உங்களுக்கு சந்திப்பு உள்ளது",
    appointmentAt: "தேதியில்",
    confirm: "உறுதிப்படுத்த, ரத்து செய்ய அல்லது மாற்றியமைக்க சொல்லுங்கள்.",
    confirmed: "உங்கள் சந்திப்பு உறுதிப்படுத்தப்பட்டது. நன்றி.",
    cancelled: "உங்கள் சந்திப்பு வெற்றிகரமாக ரத்து செய்யப்பட்டது.",
    reschedule: "சரி. புதிய சந்திப்பு தேதியை சொல்லுங்கள்.",
    askTime: "நன்றி. இப்போது விரும்பும் நேரத்தை சொல்லுங்கள்.",
    invalidDate: "தேதியை புரிந்துகொள்ள முடியவில்லை. மீண்டும் சொல்லுங்கள்.",
    invalidTime: "நேரத்தை புரிந்துகொள்ள முடியவில்லை. மீண்டும் சொல்லுங்கள்.",
    unavailableTime: "அந்த நேரம் கிடைக்கவில்லை. வேறு நேரத்தை தேர்வு செய்யுங்கள்.",
    successfulReschedule: "உங்கள் சந்திப்பு வெற்றிகரமாக மாற்றியமைக்கப்பட்டது.",
    unknown: "உங்கள் பதிலை புரிந்துகொள்ள முடியவில்லை. உறுதிப்படுத்த, ரத்து செய்ய அல்லது மாற்றியமைக்க சொல்லுங்கள்.",
    goodbye: "SmartCare AI பயன்படுத்தியதற்கு நன்றி. வணக்கம்.",
  },
  "hi-IN": {
    greeting: "नमस्ते। यह SmartCare AI है। हम आपकी मेडिकल अपॉइंटमेंट के बारे में बात कर रहे हैं।",
    appointment: "आपकी अपॉइंटमेंट है",
    appointmentAt: "को",
    confirm: "कृपया पुष्टि, रद्द या पुनर्निर्धारित कहें।",
    confirmed: "आपकी अपॉइंटमेंट की पुष्टि हो गई है। धन्यवाद।",
    cancelled: "आपकी अपॉइंटमेंट सफलतापूर्वक रद्द कर दी गई है।",
    reschedule: "ठीक है। कृपया नई अपॉइंटमेंट की तारीख बताएं।",
    askTime: "धन्यवाद। अब पसंदीदा समय बताएं।",
    invalidDate: "मैं तारीख समझ नहीं पाया। कृपया दोबारा बताएं।",
    invalidTime: "मैं समय समझ नहीं पाया। कृपया दोबारा बताएं।",
    unavailableTime: "यह समय उपलब्ध नहीं है। कृपया दूसरा समय चुनें।",
    successfulReschedule: "आपकी अपॉइंटमेंट सफलतापूर्वक पुनर्निर्धारित कर दी गई है।",
    unknown: "मैं आपका जवाब समझ नहीं पाया। कृपया पुष्टि, रद्द या पुनर्निर्धारित कहें।",
    goodbye: "SmartCare AI का उपयोग करने के लिए धन्यवाद। नमस्ते।",
  },
  "te-IN": {
    greeting: "నమస్కారం. ఇది SmartCare AI. మీ వైద్య అపాయింట్‌మెంట్ గురించి మాట్లాడుతున్నాము.",
    appointment: "మీకు అపాయింట్‌మెంట్ ఉంది",
    appointmentAt: "తేదీన",
    confirm: "నిర్ధారించడానికి, రద్దు చేయడానికి లేదా మార్చడానికి చెప్పండి.",
    confirmed: "మీ అపాయింట్‌మెంట్ నిర్ధారించబడింది. ధన్యవాదాలు.",
    cancelled: "మీ అపాయింట్‌మెంట్ విజయవంతంగా రద్దు చేయబడింది.",
    reschedule: "సరే. కొత్త అపాయింట్‌మెంట్ తేదీని చెప్పండి.",
    askTime: "ధన్యవాదాలు. ఇప్పుడు కావలసిన సమయాన్ని చెప్పండి.",
    invalidDate: "తేదీ అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.",
    invalidTime: "సమయం అర్థం కాలేదు. దయచేసి మళ్లీ చెప్పండి.",
    unavailableTime: "ఆ సమయం అందుబాటులో లేదు. మరో సమయాన్ని ఎంచుకోండి.",
    successfulReschedule: "మీ అపాయింట్‌మెంట్ విజయవంతంగా మార్చబడింది.",
    unknown: "మీ సమాధానం అర్థం కాలేదు. నిర్ధారించడానికి, రద్దు చేయడానికి లేదా మార్చడానికి చెప్పండి.",
    goodbye: "SmartCare AI ఉపయోగించినందుకు ధన్యవాదాలు. నమస్కారం.",
  },
  "ml-IN": {
    greeting: "നമസ്കാരം. ഇത് SmartCare AI ആണ്. നിങ്ങളുടെ മെഡിക്കൽ അപ്പോയിന്റ്മെന്റിനെക്കുറിച്ച് സംസാരിക്കുകയാണ്.",
    appointment: "നിങ്ങൾക്ക് അപ്പോയിന്റ്മെന്റ് ഉണ്ട്",
    appointmentAt: "തീയതിയിൽ",
    confirm: "സ്ഥിരീകരിക്കുക, റദ്ദാക്കുക അല്ലെങ്കിൽ മാറ്റിവയ്ക്കുക എന്ന് പറയുക.",
    confirmed: "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിച്ചു. നന്ദി.",
    cancelled: "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് വിജയകരമായി റദ്ദാക്കി.",
    reschedule: "ശരി. പുതിയ അപ്പോയിന്റ്മെന്റ് തീയതി പറയൂ.",
    askTime: "നന്ദി. ഇപ്പോൾ നിങ്ങൾക്ക് വേണ്ട സമയം പറയൂ.",
    invalidDate: "തീയതി മനസ്സിലായില്ല. വീണ്ടും പറയൂ.",
    invalidTime: "സമയം മനസ്സിലായില്ല. വീണ്ടും പറയൂ.",
    unavailableTime: "ആ സമയം ലഭ്യമല്ല. മറ്റൊരു സമയം തിരഞ്ഞെടുക്കൂ.",
    successfulReschedule: "നിങ്ങളുടെ അപ്പോയിന്റ്മെന്റ് വിജയകരമായി മാറ്റി.",
    unknown: "നിങ്ങളുടെ മറുപടി മനസ്സിലായില്ല. സ്ഥിരീകരിക്കുക, റദ്ദാക്കുക അല്ലെങ്കിൽ മാറ്റിവയ്ക്കുക എന്ന് പറയൂ.",
    goodbye: "SmartCare AI ഉപയോഗിച്ചതിന് നന്ദി. നമസ്കാരം.",
  },
  "kn-IN": {
    greeting: "ನಮಸ್ಕಾರ. ಇದು SmartCare AI. ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಬಗ್ಗೆ ಮಾತನಾಡುತ್ತಿದ್ದೇವೆ.",
    appointment: "ನಿಮಗೆ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಇದೆ",
    appointmentAt: "ದಿನಾಂಕದಂದು",
    confirm: "ದೃಢೀಕರಿಸಲು, ರದ್ದುಪಡಿಸಲು ಅಥವಾ ಮರುನಿಗದಿಪಡಿಸಲು ಹೇಳಿ.",
    confirmed: "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ. ಧನ್ಯವಾದಗಳು.",
    cancelled: "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಯಶಸ್ವಿಯಾಗಿ ರದ್ದುಗೊಂಡಿದೆ.",
    reschedule: "ಸರಿ. ಹೊಸ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ದಿನಾಂಕವನ್ನು ಹೇಳಿ.",
    askTime: "ಧನ್ಯವಾದಗಳು. ಈಗ ನಿಮಗೆ ಬೇಕಾದ ಸಮಯವನ್ನು ಹೇಳಿ.",
    invalidDate: "ದಿನಾಂಕ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.",
    invalidTime: "ಸಮಯ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ.",
    unavailableTime: "ಆ ಸಮಯ ಲಭ್ಯವಿಲ್ಲ. ಬೇರೆ ಸಮಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
    successfulReschedule: "ನಿಮ್ಮ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಯಶಸ್ವಿಯಾಗಿ ಮರುನಿಗದಿಪಡಿಸಲಾಗಿದೆ.",
    unknown: "ನಿಮ್ಮ ಉತ್ತರ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದೃಢೀಕರಿಸಲು, ರದ್ದುಪಡಿಸಲು ಅಥವಾ ಮರುನಿಗದಿಪಡಿಸಲು ಹೇಳಿ.",
    goodbye: "SmartCare AI ಬಳಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಮಸ್ಕಾರ.",
  },
};

function getLanguage(appointment) {
  const language = appointment?.voiceLanguage || "en-IN";
  return SUPPORTED_LANGUAGES.includes(language) ? language : "en-IN";
}

function getText(appointment) {
  const language = getLanguage(appointment);
  return LANGUAGE_TEXT[language] || LANGUAGE_TEXT["en-IN"];
}

function addSpeechGather(response, appointmentId, appointment, prompt, req) {
  const baseUrl = getPublicBaseUrl(req);
  const language = getLanguage(appointment);
  const action = `${baseUrl}/api/voice/handle-response?appointmentId=${encodeURIComponent(appointmentId)}`;
  const gather = response.gather({ input: "speech", action, method: "POST", language, speechTimeout: "auto", timeout: 5, actionOnEmptyResult: true });
  gather.say({ language }, prompt);
  return gather;
}

// =====================================================
// TEST CALL — POST /api/voice/test
// =====================================================
router.post("/test", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ message: "phoneNumber is required." });
    const call = await makeTestCall(phoneNumber);
    return res.json({ message: "Test call initiated successfully.", callSid: call.sid, status: call.status });
  } catch (error) {
    console.error("Test call error:", error);
    return res.status(500).json({ message: "Failed to initiate test call.", error: error.message });
  }
});

// =====================================================
// APPOINTMENT CALL — POST /api/voice/appointment-call
// =====================================================
router.post("/appointment-call", authenticateToken, async (req, res) => {
  try {
    const { appointmentId } = req.body;

    if (!appointmentId) return res.status(400).json({ message: "appointmentId is required." });
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) return res.status(400).json({ message: "Invalid appointment ID." });

    const appointment = await Appointment.findById(appointmentId).populate("patient").populate("doctor");
    if (!appointment) return res.status(404).json({ message: "Appointment not found." });
    if (appointment.patient?._id?.toString() !== req.user.id && appointment.patient?.toString() !== req.user.id) {
      return res.status(403).json({ message: "You cannot initiate a call for this appointment." });
    }
    if (appointment.status === "Cancelled") return res.status(400).json({ message: "Cannot call for a cancelled appointment." });

    const language = getLanguage(appointment);
    const patientName = appointment.patient?.name || "Patient";
    const doctorName = appointment.doctor?.name || "your doctor";
    const appointmentDate = appointment.appointmentDate || "";
    const appointmentTime = appointment.appointmentTime || "";

    const greeting =
      `Hello ${patientName}. ` +
      `This is SmartCare AI. ` +
      `You have an appointment with ${doctorName} ` +
      `on ${appointmentDate} at ${appointmentTime}. ` +
      `Would you like to confirm, cancel, or reschedule this appointment?`;

    appointment.voiceConversation = { active: true, step: "NONE", requestedDate: null, requestedTime: null, attempts: 0 };

    const twimlResponse = new VoiceResponse();
    addSpeechGather(twimlResponse, appointment._id.toString(), appointment, greeting);
    twimlResponse.say({ language }, "Sorry, I did not hear a response. Goodbye.");
    twimlResponse.hangup();

    const call = await makeAppointmentCall(appointment.phoneNumber, appointment._id.toString());

    appointment.voiceCall = { sid: call.sid, status: call.status, lastAttemptAt: new Date() };
    await appointment.save();

    return res.json({ message: "Appointment voice call initiated.", callSid: call.sid, status: call.status });
  } catch (error) {
    console.error("Appointment call error:", error);
    return res.status(500).json({ message: "Failed to initiate appointment call.", error: error.message });
  }
});

// =====================================================
// TWIML — ALL (GET/POST) /api/voice/twiml
// =====================================================
router.all("/twiml", async (req, res) => {
  const response = new VoiceResponse();
  try {
    const appointmentId = req.query.appointmentId || req.body.appointmentId;
    console.log("TwiML request for appointmentId:", appointmentId);

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      // Support test calls or calls without an appointmentId
      response.say({ language: "en-IN" }, "Hello! This is SmartCare AI test call. Your voice setup is working successfully. Goodbye.");
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    const appointment = await Appointment.findById(appointmentId).populate("patient").populate("doctor");
    if (!appointment) {
      response.say("Sorry, your appointment could not be found. Goodbye.");
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    const language = getLanguage(appointment);
    const patientName = appointment.patient?.name || "Patient";
    const doctorName = appointment.doctor?.name || "your doctor";
    const appointmentDate = appointment.appointmentDate || "";
    const appointmentTime = appointment.appointmentTime || "";

    const greeting =
      `Hello ${patientName}. ` +
      `This is SmartCare AI. ` +
      `You have an appointment with ${doctorName} ` +
      `on ${appointmentDate} at ${appointmentTime}. ` +
      `Would you like to confirm, cancel, or reschedule this appointment?`;

    appointment.voiceConversation = { active: true, step: "NONE", requestedDate: null, requestedTime: null, attempts: 0 };
    await appointment.save();

    addSpeechGather(response, appointment._id.toString(), appointment, greeting);
    response.say({ language }, "Sorry, I did not hear a response. Goodbye.");
    response.hangup();

    res.type("text/xml");
    return res.send(response.toString());
  } catch (error) {
    console.error("TwiML error:", error);
    response.say("Sorry, SmartCare AI is temporarily unavailable. Please try again later.");
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  }
});

// =====================================================
// HANDLE SPEECH RESPONSE — ALL (GET/POST) /api/voice/handle-response
// =====================================================
router.all("/handle-response", async (req, res) => {
  const response = new VoiceResponse();
  try {
    const appointmentId = req.query.appointmentId || req.body.appointmentId;
    const speechResult = req.body.SpeechResult || req.body.speechResult || req.query.SpeechResult || req.query.speechResult || "";

    console.log("Handle response - appointmentId:", appointmentId);
    console.log("Handle response - SpeechResult:", speechResult);

    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      response.say("Sorry, there was a problem. Goodbye.");
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    const appointment = await Appointment.findById(appointmentId).populate("patient").populate("doctor");
    if (!appointment) {
      response.say("Sorry, your appointment could not be found. Goodbye.");
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    const language = getLanguage(appointment);
    const text = getText(appointment);
    const step = appointment.voiceConversation?.step || "NONE";

    // Handle reschedule sub-steps first
    if (step === "WAITING_FOR_DATE") {
      return await handleRescheduleDate(res, response, appointment, speechResult, language, text);
    }
    if (step === "WAITING_FOR_TIME") {
      return await handleRescheduleTime(res, response, appointment, speechResult, language, text);
    }

    // Primary intent detection
    const { intent } = await analyzeVoiceIntent(speechResult);
    console.log("Voice intent:", intent);

    if (intent === "CONFIRM") {
      appointment.status = "Confirmed";
      await appointment.save();
      response.say({ language }, text.confirmed);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    if (intent === "CANCEL") {
      appointment.status = "Cancelled";
      appointment.voiceConversation = { active: false, step: "NONE", requestedDate: null, requestedTime: null, attempts: 0 };
      await appointment.save();
      response.say({ language }, text.cancelled);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    if (intent === "RESCHEDULE") {
      appointment.voiceConversation = { active: true, step: "WAITING_FOR_DATE", requestedDate: null, requestedTime: null, attempts: 0 };
      await appointment.save();
      addSpeechGather(response, appointmentId, appointment, text.reschedule);
      response.say({ language }, text.goodbye);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    // UNKNOWN
    addSpeechGather(response, appointmentId, appointment, text.unknown);
    response.say({ language }, text.goodbye);
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  } catch (error) {
    console.error("Handle response error:", error);
    response.say("Sorry, SmartCare AI encountered an error. Please try again later.");
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  }
});

// =====================================================
// RESCHEDULE DATE HANDLER
// =====================================================
async function handleRescheduleDate(res, response, appointment, speechResult, language, text) {
  const appointmentId = appointment._id.toString();
  try {
    const { date } = await extractRescheduleDate(speechResult);
    console.log("Extracted reschedule date:", date);

    if (!date) {
      addSpeechGather(response, appointmentId, appointment, text.invalidDate);
      response.say({ language }, text.goodbye);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    appointment.voiceConversation.requestedDate = date;
    appointment.voiceConversation.step = "WAITING_FOR_TIME";
    await appointment.save();

    addSpeechGather(response, appointmentId, appointment, text.askTime);
    response.say({ language }, text.goodbye);
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  } catch (error) {
    console.error("Reschedule date handler error:", error);
    response.say({ language }, text.invalidDate);
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  }
}

// =====================================================
// RESCHEDULE TIME HANDLER
// =====================================================
async function handleRescheduleTime(res, response, appointment, speechResult, language, text) {
  const appointmentId = appointment._id.toString();
  try {
    const { time } = await extractRescheduleTime(speechResult);
    console.log("Extracted reschedule time:", time);

    if (!time || !TIME_SLOTS.includes(time)) {
      addSpeechGather(response, appointmentId, appointment, text.invalidTime);
      response.say({ language }, text.goodbye);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    const requestedDate = appointment.voiceConversation?.requestedDate;
    if (!requestedDate) {
      appointment.voiceConversation = { active: false, step: "NONE", requestedDate: null, requestedTime: null, attempts: 0 };
      await appointment.save();
      response.say({ language }, text.invalidDate);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctor: appointment.doctor,
      appointmentDate: requestedDate,
      appointmentTime: time,
      status: { $ne: "Cancelled" },
    });

    if (conflict) {
      addSpeechGather(response, appointmentId, appointment, text.unavailableTime);
      response.say({ language }, text.goodbye);
      response.hangup();
      res.type("text/xml");
      return res.send(response.toString());
    }

    appointment.appointmentDate = requestedDate;
    appointment.appointmentTime = time;
    appointment.status = "Confirmed";
    appointment.voiceConversation = { active: false, step: "NONE", requestedDate: null, requestedTime: null, attempts: 0 };
    await appointment.save();

    response.say({ language }, text.successfulReschedule);
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  } catch (error) {
    console.error("Reschedule time handler error:", error);
    response.say({ language }, text.invalidTime);
    response.hangup();
    res.type("text/xml");
    return res.send(response.toString());
  }
}

// =====================================================
// CALL STATUS CALLBACK — POST /api/voice/call-status
// =====================================================
router.post("/call-status", async (req, res) => {
  try {
    const appointmentId = req.query.appointmentId || req.body.appointmentId;
    const callSid = req.body.CallSid;
    const callStatus = req.body.CallStatus;

    console.log("Call status update:", callSid, "->", callStatus, "for appointment:", appointmentId);

    if (appointmentId && mongoose.Types.ObjectId.isValid(appointmentId)) {
      await Appointment.findByIdAndUpdate(appointmentId, {
        "voiceCall.sid": callSid,
        "voiceCall.status": callStatus,
        "voiceCall.lastAttemptAt": new Date(),
      });
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error("Call status error:", error);
    return res.sendStatus(200);
  }
});

module.exports = router;
