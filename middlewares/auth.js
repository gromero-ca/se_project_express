const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../utils/config");
const { UNAUTHORIZED } = require("../utils/errors");

const auth = (req, res, next) => {
  const { authorization } = req.headers || {};

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(UNAUTHORIZED).send({ message: "Authorization required" });
  }

  const token = authorization.replace("Bearer ", "");
  let payload;

  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res
      .status(UNAUTHORIZED)
      .send({ message: "Invalid or expired token" });
  }

  if (!payload || typeof payload !== "object" || !payload._id) {
    return res
      .status(UNAUTHORIZED)
      .send({ message: "Invalid or expired token" });
  }

  req.user = payload;
  return next();
};

module.exports = auth;
