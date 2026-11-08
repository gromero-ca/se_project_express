const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const NOT_FOUND = 404;
const CONFLICT = 409;
const TOO_MANY_REQUESTS = 429;
const INTERNAL_SERVER_ERROR = 500;

const sendServerError = (res) =>
  res
    .status(INTERNAL_SERVER_ERROR)
    .send({ message: "An error has occurred on the server." });

module.exports = {
  BAD_REQUEST,
  UNAUTHORIZED,
  FORBIDDEN,
  NOT_FOUND,
  CONFLICT,
  TOO_MANY_REQUESTS,
  INTERNAL_SERVER_ERROR,
  sendServerError,
};
