const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || Buffer.byteLength(JWT_SECRET) < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 bytes.");
}

module.exports = JWT_SECRET;
