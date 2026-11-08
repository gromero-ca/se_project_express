const { createHash } = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const { RequestError } = require("../errors");
const { TOO_MANY_REQUESTS } = require("../utils/errors");

const createAuthLimiters = ({
  windowMs = 15 * 60 * 1000,
  ipLimit = 50,
  accountLimit = 10,
} = {}) => {
  const options = {
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) =>
      next(
        new RequestError(
          "Too many authentication attempts. Please try again later.",
          TOO_MANY_REQUESTS
        )
      ),
  };

  return {
    authLimiter: rateLimit({
      ...options,
      limit: ipLimit,
      identifier: "authentication-ip",
    }),
    signinLimiter: rateLimit({
      ...options,
      limit: accountLimit,
      identifier: "signin-account",
      skipSuccessfulRequests: true,
      keyGenerator: (req) =>
        createHash("sha256")
          .update(req.body.email.trim().toLowerCase())
          .digest("hex"),
    }),
  };
};

module.exports = createAuthLimiters;
