let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[SECURITY WARNING] JWT_SECRET is missing or less than 32 bytes. Please configure a strong JWT_SECRET in environment variables."
    );
  }
  JWT_SECRET = JWT_SECRET || "smartcare-fallback-jwt-secret-min-32-chars-long";
}

module.exports = JWT_SECRET;
