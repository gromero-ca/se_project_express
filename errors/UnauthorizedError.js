const RequestError = require("./RequestError");
const { UNAUTHORIZED } = require("../utils/errors");

class UnauthorizedError extends RequestError {
  constructor(message) {
    super(message, UNAUTHORIZED);
  }
}
module.exports = UnauthorizedError;
