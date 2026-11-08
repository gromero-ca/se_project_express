const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { JWT_SECRET } = require("../utils/config");
const { BadRequestError } = require("../errors");

const getCurrentUser = (req, res, next) =>
  User.findById(req.user._id)
    .orFail()
    .then((user) => res.send(user))
    .catch(next);

const updateCurrentUser = (req, res, next) => {
  const { name, avatar } = req.body || {};
  return User.findByIdAndUpdate(
    req.user._id,
    { name, avatar },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((user) => res.send(user))
    .catch(next);
};

const createUser = (req, res, next) => {
  const { name, avatar, email, password } = req.body || {};
  if (typeof password !== "string" || !password) {
    return next(
      new BadRequestError(
        "Invalid data passed to the method for creating a user"
      )
    );
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
    .catch(next);
};

const login = (req, res, next) => {
  const { email, password } = req.body || {};
  return User.findUserByCredentials(email, password)
    .then((user) => {
      const token = jwt.sign({ _id: user._id }, JWT_SECRET, {
        expiresIn: "7d",
      });
      return res.send({ token });
    })
    .catch(next);
};

module.exports = { getCurrentUser, updateCurrentUser, createUser, login };
