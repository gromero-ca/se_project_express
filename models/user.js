const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const { UNAUTHORIZED } = require("../utils/errors");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 30,
  },
  avatar: {
    type: String,
    required: true,
    validate: {
      validator: (value) => validator.isURL(value),
      message: "You must enter a valid URL",
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    sparse: true,
    validate: {
      validator: (value) => validator.isEmail(value),
      message: "You must enter a valid email address",
    },
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
});

userSchema.statics.findUserByCredentials = async function findUserByCredentials(
  email,
  password
) {
  const unauthorizedError = () => {
    const error = new Error("Incorrect email or password");
    error.statusCode = UNAUTHORIZED;
    return error;
  };

  if (typeof email !== "string" || typeof password !== "string") {
    throw unauthorizedError();
  }

  const user = await this.findOne({ email }).select("+password");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorizedError();
  }

  return user;
};

module.exports = mongoose.model("user", userSchema);
