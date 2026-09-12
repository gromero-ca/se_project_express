const express = require("express");
const mongoose = require("mongoose");

const usersRouter = require("./routes/users");
const itemsRouter = require("./routes/items");
const { BAD_REQUEST, NOT_FOUND, sendServerError } = require("./utils/errors");

const { PORT = 3001 } = process.env;
const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  req.user = {
    _id: "5d8b8592978f8bd833ca8133",
  };
  next();
});

app.use("/users", usersRouter);
app.use("/items", itemsRouter);

app.use((req, res) => {
  res.status(NOT_FOUND).send({ message: "Requested resource not found" });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === BAD_REQUEST) {
    return res.status(BAD_REQUEST).send({ message: "Invalid request data" });
  }

  return sendServerError(res, error);
});

mongoose
  .connect("mongodb://localhost:27017/wtwr_db")
  .then(() => {
    app.listen(PORT);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = app;
