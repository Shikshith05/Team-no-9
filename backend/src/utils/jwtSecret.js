// PRJ-SR-003 / SAD 3.9: JWTs are signed with a secret of at least 256 bits.
// .env.example ships a placeholder so local development works straight after
// copying it (B19). In production that placeholder would let anyone forge tokens,
// so the API refuses to start with it.
const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PREFIX = "change_me";

function jwtSecretProblem(env = process.env) {
  if (env.NODE_ENV !== "production") return null;
  const secret = env.JWT_SECRET || "";
  if (secret.startsWith(PLACEHOLDER_PREFIX)) {
    return "JWT_SECRET is still the placeholder from .env.example. Generate one with: openssl rand -hex 32";
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters. Generate one with: openssl rand -hex 32`;
  }
  return null;
}

module.exports = { jwtSecretProblem };
