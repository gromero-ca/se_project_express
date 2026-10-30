const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { JWT_SECRET } = require("../utils/config");
const {
  BAD_REQUEST,
  UNAUTHORIZED,
  NOT_FOUND,
  CONFLICT,
  sendServerError,
} = require("../utils/errors");

const sendUserError = (error, res, validationMessage) => {
  if (error.name === "CastError") {
    return res.status(BAD_REQUEST).send({ message: "Invalid user id" });
  }

  if (error.name === "ValidationError") {
    return res.status(BAD_REQUEST).send({ message: validationMessage });
  }

  if (error.name === "DocumentNotFoundError") {
    return res.status(NOT_FOUND).send({ message: "User not found" });
  }

  if (error.code === 11000) {
    return res
      .status(CONFLICT)
      .send({ message: "Email address already exists" });
  }

  if (error.statusCode === UNAUTHORIZED) {
    return res
      .status(UNAUTHORIZED)
      .send({ message: "Incorrect email or password" });
  }

  console.error(error);
  return sendServerError(res);
};

const getCurrentUser = (req, res) =>
  User.findById(req.user._id)
    .orFail()
    .then((user) => res.send(user))
    .catch((error) =>
      sendUserError(error, res, "Invalid data passed to the method")
    );

const updateCurrentUser = (req, res) => {
  const { name, avatar } = req.body || {};

  return User.findByIdAndUpdate(
    req.user._id,
    { name, avatar },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((user) => res.send(user))
    .catch((error) =>
      sendUserError(
        error,
        res,
        "Invalid data passed to the method for updating a user"
      )
    );
};

const createUser = (req, res) => {
  const { name, avatar, email, password } = req.body || {};

  if (typeof password !== "string" || password.length === 0) {
    return res.status(BAD_REQUEST).send({
      message: "Invalid data passed to the method for creating a user",
    });
  }

  return bcrypt
    .hash(password, 10)
    .then((passwordHash) =>
      User.create({ name, avatar, email, password: passwordHash })
    )
    .then((user) => {
      const userData = user.toObject();
      delete userData.password;
      return res.status(201).send(userData);
    })
    .catch((error) =>
      sendUserError(
        error,
        res,
        "Invalid data passed to the method for creating a user"
      )
    );
};

const login = (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(BAD_REQUEST)
      .send({ message: "Email and password are required" });
  }

  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
        expiresIn: "7d",
      });
      return res.send({ token });
    })
    .catch((error) => sendUserError(error, res, "Invalid credentials"));
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  createUser,
  login,
};
