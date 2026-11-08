const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../utils/config");
const { UnauthorizedError } = require("../errors");

const auth = (req, _res, next) => {
  const { authorization } = req.headers || {};
  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return next(new UnauthorizedError("Authorization required"));
  }
  let payload;
  try {
    payload = jwt.verify(authorization.slice(7), JWT_SECRET);
  } catch (error) {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
  if (!payload || typeof payload !== "object" || !payload._id) {
    return next(new UnauthorizedError("Invalid or expired token"));
  }
  req.user = payload;
  return next();
};

module.exports = auth;
