const express = require("express");
const mongoose = require("mongoose");

const router = require("./routes");
const { BAD_REQUEST, sendServerError } = require("./utils/errors");

const { PORT = 3001 } = process.env;
const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  req.user = {
    _id: "5d8b8592978f8bd833ca8133",
  };
  next();
});

app.use(router);

app.use((error, _req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === BAD_REQUEST) {
    return res.status(BAD_REQUEST).send({ message: "Invalid request data" });
  }

  return sendServerError(res);
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
