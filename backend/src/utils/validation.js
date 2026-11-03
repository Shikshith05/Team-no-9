// Registration input rules (B4, #57). They follow the SAD password policy
// (PWM-F-001, TC-Auth-01) and match frontend/src/lib/validation.js, so the
// browser and the API give the same answer.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 255; // users.name is VARCHAR(255)

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;

// Common passwords that would otherwise pass the length and letters+digits
// rules. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  "password123",
  "password1234",
  "password12345",
  "passw0rd123",
  "qwerty12345",
  "qwerty123456",
  "qwertyuiop1",
  "abc1234567",
  "abcd123456",
  "iloveyou123",
  "welcome1234",
  "letmein1234",
  "admin12345",
  "administrator1",
  "1234567890a",
  "a1234567890",
  "123456789a",
  "1q2w3e4r5t",
  "1qaz2wsx3edc",
  "zaq12wsx3edc"
]);

function validateEmail(email) {
  if (!email) return "Email is required.";
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address, like name@example.com.";
  }
  return null;
}

function validatePassword(password) {
  if (typeof password !== "string" || password === "") return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  if (!/\p{L}/u.test(password)) return "Password must include at least one letter.";
  if (!/\p{Nd}/u.test(password)) return "Password must include at least one number.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "This password is too common. Choose another one.";
  return null;
}

function validateName(name) {
  if (typeof name !== "string" || name.trim() === "") return "Name is required.";
  if (name.trim().length > NAME_MAX_LENGTH) return `Name must be at most ${NAME_MAX_LENGTH} characters.`;
  return null;
}

// All problems at once, as [{ field, message }] (empty when valid).
// `email` must already be normalized (trimmed, lowercased).
function validateRegistration({ name, email, password }) {
  const checks = [
    ["name", validateName(name)],
    ["email", validateEmail(email)],
    ["password", validatePassword(password)]
  ];
  return checks.filter(([, message]) => message).map(([field, message]) => ({ field, message }));
}

module.exports = {
  validateRegistration,
  validateEmail,
  validatePassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH
};
