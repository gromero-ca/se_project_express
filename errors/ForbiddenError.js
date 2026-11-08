const RequestError = require("./RequestError");
const { FORBIDDEN } = require("../utils/errors");

class ForbiddenError extends RequestError {
  constructor(message) {
    super(message, FORBIDDEN);
  }
}
module.exports = ForbiddenError;
