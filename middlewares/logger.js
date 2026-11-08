const winston = require("winston");
const { classifyError } = require("./error");

const requestLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "request.log" })],
});
const errorLogger = winston.createLogger({
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: "error.log" })],
});

const logRequest = (req, res, next) => {
  res.on("finish", () =>
    requestLogger.info({ method: req.method, status: res.statusCode })
  );
  next();
};
const logError = (err, req, res, next) => {
  errorLogger.error({
    method: req.method,
    status: classifyError(err).status,
    name: err.name,
  });
  next(err);
};

module.exports = { logRequest, logError };
