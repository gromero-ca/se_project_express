const RequestError = require("./RequestError");
const { CONFLICT } = require("../utils/errors");

class ConflictError extends RequestError {
  constructor(message) {
    super(message, CONFLICT);
  }
}
module.exports = ConflictError;
