const RequestError = require("./RequestError");
const { NOT_FOUND } = require("../utils/errors");

class NotFoundError extends RequestError {
  constructor(message) {
    super(message, NOT_FOUND);
  }
}
module.exports = NotFoundError;
