const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const router = require("./routes");
const { BAD_REQUEST, sendServerError } = require("./utils/errors");

const { PORT = 3001 } = process.env;
const app = express();

app.use(cors());
app.use(express.json());

app.use(router);

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === BAD_REQUEST) {
    return res.status(BAD_REQUEST).send({ message: "Invalid request data" });
  }

  console.error(error);
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
