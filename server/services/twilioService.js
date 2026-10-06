const twilio = require("twilio");

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not configured.");
  }
  return twilio(accountSid, authToken);
}

function getTwilioPhoneNumber() {
  return process.env.TWILIO_PHONE_NUMBER;
}

function getPublicBaseUrl() {
  const url = (process.env.PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!url || url.includes("ngrok-free.dev") || url.includes("ngrok.io") || url.includes("localhost") || url.includes("127.0.0.1")) {
    return "https://smart-care-ai-a33e.vercel.app";
  }
  return url;
}

// =====================================================
// BASIC TEST CALL
// =====================================================

async function makeTestCall(to) {
  if (!to) {
    throw new Error("Recipient phone number is required.");
  }

  const client = getClient();
  const twilioPhoneNumber = getTwilioPhoneNumber();
  const baseUrl = getPublicBaseUrl();

  const callOptions = {
    from: twilioPhoneNumber,
    to,
  };

  if (baseUrl) {
    callOptions.url = `${baseUrl}/api/voice/twiml`;
  } else {
    callOptions.url = "https://webhooks.twilio.com/v1/Voice/Template/voice_text_to_speech";
  }

  const call = await client.calls.create(callOptions);
  return call;
}

// =====================================================
// APPOINTMENT VOICE CALL (Trial-compatible)
// =====================================================

async function makeAppointmentCall(to, appointmentId) {
  if (!to) {
    throw new Error("Recipient phone number is required.");
  }

  if (!appointmentId) {
    throw new Error("Appointment ID is required.");
  }

  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    throw new Error("PUBLIC_BASE_URL is not configured.");
  }

  const client = getClient();
  const twilioPhoneNumber = getTwilioPhoneNumber();

  const twimlUrl = `${baseUrl}/api/voice/twiml?appointmentId=${encodeURIComponent(appointmentId)}`;

  // Twilio Free Trial ONLY allows from, to, and url (no statusCallback, no inline twiml)
  const call = await client.calls.create({
    from: twilioPhoneNumber,
    to,
    url: twimlUrl,
  });

  return call;
}

module.exports = {
  makeTestCall,
  makeAppointmentCall,
};