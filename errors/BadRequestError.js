const RequestError = require("./RequestError");
const { BAD_REQUEST } = require("../utils/errors");

class BadRequestError extends RequestError {
  constructor(message) {
    super(message, BAD_REQUEST);
  }
}
module.exports = BadRequestError;
