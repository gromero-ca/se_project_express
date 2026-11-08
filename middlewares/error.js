const { isCelebrateError } = require("celebrate");
const { INTERNAL_SERVER_ERROR } = require("../utils/errors");

const classifyError = (err) => {
  let status = err.statusCode || err.status;
  let { message } = err;
  if (
    isCelebrateError(err) ||
    err.name === "ValidationError" ||
    err.name === "CastError" ||
    (err instanceof SyntaxError && status === 400)
  ) {
    status = 400;
    message = "Invalid request data";
  } else if (err.name === "DocumentNotFoundError") {
    status = 404;
    message = "Requested resource not found";
  } else if (err.code === 11000) {
    status = 409;
    message = "Email address already exists";
  }
  if (!status || status >= 500) {
    status = INTERNAL_SERVER_ERROR;
    message = "An error has occurred on the server.";
  }
  return { status, message };
};

const errorHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const { status, message } = classifyError(err);
  return res.status(status).send({ message });
};

module.exports = errorHandler;
module.exports.classifyError = classifyError;
