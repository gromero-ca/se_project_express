const User = require("../models/user");
const { BAD_REQUEST, NOT_FOUND, sendServerError } = require("../utils/errors");

const getUsers = (_req, res) => {
  User.find({})
    .then((users) => res.send(users))
    .catch((error) => sendServerError(res, error));
};

const getUser = (req, res) => {
  User.findById(req.params.userId)
    .orFail()
    .then((user) => res.send(user))
    .catch((error) => {
      if (error.name === "CastError") {
        return res.status(BAD_REQUEST).send({ message: "Invalid user id" });
      }

      if (error.name === "DocumentNotFoundError") {
        return res.status(NOT_FOUND).send({ message: "User not found" });
      }

      return sendServerError(res, error);
    });
};

const createUser = (req, res) => {
  const { name, avatar } = req.body || {};

  User.create({
    name,
    avatar,
  })
    .then((user) => res.status(201).send(user))
    .catch((error) => {
      if (error.name === "ValidationError") {
        return res.status(BAD_REQUEST).send({
          message: "Invalid data passed to the method for creating a user",
        });
      }

      return sendServerError(res, error);
    });
};

module.exports = {
  getUsers,
  getUser,
  createUser,
};
