// Standard response envelope (NFR-MNT-04).
//
// The requirement asks for `{ success: false, message, error }` on errors, and
// the audit found **0 of ~314 handlers** producing it. Rewriting three hundred
// call sites by hand would be a large, risky change that touches every feature at
// once, and the first one anybody forgot would make the contract a lie again.
//
// So the envelope is applied centrally, at the response layer, and **additively**:
//
//   * `success` is added when absent, derived from the status code.
//   * `error` is added to error responses when absent, so the field the contract
//     promises always exists.
//   * Everything already in the body is left exactly as it was.
//
// Additive matters. Every existing client reads `message`, and several read
// domain fields (`code`, `details`, `user`, `entries`, ...). Nothing is renamed
// or removed, so no consumer has to change for this to be true - which is what
// makes it safe to switch on for the whole application in one step.

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Reason phrases for the status codes this API actually returns, so `error` says
// something even when a handler supplied only a message.
const REASON_PHRASES = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

export const errorEnvelope = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    // Arrays and primitives are passed through untouched. Some endpoints return a
    // bare array, and wrapping one in an object to add `success` would break every
    // client that iterates the response - which is the opposite of additive.
    if (!isPlainObject(body)) return originalJson(body);

    const isError = res.statusCode >= 400;

    if (!Object.prototype.hasOwnProperty.call(body, "success")) {
      body.success = !isError;
    }

    // The contract promises an `error` field on failures. Handlers that already
    // supply one keep it; the rest get the message or the status reason, so the
    // field is never missing rather than sometimes present.
    if (isError && !Object.prototype.hasOwnProperty.call(body, "error")) {
      body.error = body.message || REASON_PHRASES[res.statusCode] || "Request failed";
    }

    return originalJson(body);
  };

  next();
};

// A route that matches nothing. Previously this fell through to Express's default
// handler and answered with an HTML page, which a JSON client cannot parse.
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    message: `No route matches ${req.method} ${req.originalUrl}`,
  });
};

// Anything a handler threw or passed to `next(error)`.
//
// The message is deliberately generic: an unhandled error's own message can carry
// a stack frame, a SQL fragment or a file path, and this is the last place before
// it reaches a client. The detail is logged instead.
export const errorHandler = (error, req, res, _next) => {
  console.error(`UNHANDLED ERROR [${req.method} ${req.originalUrl}]:`, error);

  if (res.headersSent) return;

  // Multer and similar libraries attach a status; honour it when it is a client
  // error rather than turning every one of them into a 500.
  const status = Number(error.status || error.statusCode);
  const safeStatus = Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;

  res.status(safeStatus).json({
    message: safeStatus === 500 ? "An unexpected error occurred." : error.message,
    error: safeStatus === 500 ? "Internal Server Error" : error.message,
  });
};

export default { errorEnvelope, notFoundHandler, errorHandler };
