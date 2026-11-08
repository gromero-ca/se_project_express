require("dotenv").config({ quiet: true });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const router = require("./routes");
const { logRequest, logError } = require("./middlewares/logger");
const errorHandler = require("./middlewares/error");

const { PORT = 3001 } = process.env;
const app = express();

app.use(logRequest);
app.use(cors());
app.use(express.json());
app.get("/crash-test", () => {
  setTimeout(() => {
    throw new Error("Server will crash now");
  }, 0);
});
app.use(router);
app.use(logError);
app.use(errorHandler);

mongoose
  .connect("mongodb://localhost:27017/wtwr_db")
  .then(() => {
    app.listen(PORT, "127.0.0.1");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = app;
