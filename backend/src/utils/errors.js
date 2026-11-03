// API errors in the SAD format (B6, #55):
//   { "error": { "code": "VALIDATION_ERROR", "message": "...",
//                "fields": [{ "field": "email", "message": "..." }] } }
// frontend/src/api/http.js reads exactly error.code, error.message and
// error.fields. Controllers throw an AppError (or let an unexpected error
// propagate); errorHandler turns it into the response. Unexpected errors
// are logged on the server only: the client gets a generic message and
// never database or stack-trace details.

class AppError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const validationError = (fields, message = "Please correct the highlighted fields.") =>
  new AppError(400, "VALIDATION_ERROR", message, fields);
const unauthorized = (message = "Authentication required.") => new AppError(401, "UNAUTHORIZED", message);
const accountLocked = (message) => new AppError(423, "ACCOUNT_LOCKED", message);
const notFound = (message = "Not found.") => new AppError(404, "NOT_FOUND", message);
const conflict = (message, fields = []) => new AppError(409, "CONFLICT", message, fields);
// Well-formed but refused by a business rule (SAD 4.3.4), e.g. MARKET_VALUED.
const unprocessable = (code, message) => new AppError(422, code, message);

function errorBody(code, message, fields = []) {
  return { error: { code, message, fields } };
}

// Express error-handling middleware (must keep all four parameters).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    // A streamed response (e.g. the PDF export) already started.
    console.error(err);
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.status).json(errorBody(err.code, err.message, err.fields));
  }

  // express.json() could not parse the request body.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json(errorBody("VALIDATION_ERROR", "Request body must be valid JSON."));
  }

  console.error(`${req.method} ${req.originalUrl} failed:`, err);
  return res.status(500).json(errorBody("INTERNAL_ERROR", "Something went wrong. Please try again later."));
}

// Unknown /api routes answer in the same format instead of Express's HTML page.
function apiNotFound(req, res) {
  res.status(404).json(errorBody("NOT_FOUND", "API endpoint not found."));
}

module.exports = {
  AppError,
  validationError,
  unauthorized,
  accountLocked,
  notFound,
  conflict,
  unprocessable,
  errorBody,
  errorHandler,
  apiNotFound
};
