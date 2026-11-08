const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const mongoose = require("mongoose");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const User = require("../models/user");

const logDirectory = fsSync.mkdtempSync(path.join(os.tmpdir(), "wtwr-test-"));
process.chdir(logDirectory);

const originalConnect = mongoose.connect;
mongoose.connect = () => new Promise(() => {});
const app = require("../app");

mongoose.connect = originalConnect;

test("signup rejects invalid email before creating a user", async () => {
  const originalCreate = User.create;
  User.create = async () => ({ toObject: () => ({ name: "test" }) });
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/signup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          avatar: "https://example.com/a",
          email: "invalid",
          password: "secret",
        }),
      }
    );
    assert.equal(response.status, 400);
    assert.deepEqual(Object.keys(await response.json()), ["message"]);
  } finally {
    User.create = originalCreate;
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

test("signin treats a malformed nonempty email as incorrect credentials", async () => {
  const originalFind = User.findUserByCredentials;
  User.findUserByCredentials = async () => {
    const error = new Error("Incorrect email or password");
    error.statusCode = 401;
    throw error;
  };
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/signin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid", password: "secret" }),
      }
    );
    assert.equal(response.status, 401);
  } finally {
    User.findUserByCredentials = originalFind;
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

test("validation error logs its response status without sensitive input", async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/signup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          avatar: "https://example.com/a",
          email: "invalid",
          password: "unique-test-password",
        }),
      }
    );
    assert.equal(response.status, 400);
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    const entries = (await fs.readFile("error.log", "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse);
    const entry = entries[entries.length - 1];
    assert.equal(entry.message.status, 400);
    assert.equal(JSON.stringify(entry).includes("unique-test-password"), false);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});

test("unexpected errors return the required generic 500 message", async () => {
  const originalFind = User.findUserByCredentials;
  User.findUserByCredentials = async () => {
    throw new Error("sensitive internal detail");
  };
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, resolve);
  });
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/signin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@example.com",
          password: "secret",
        }),
      }
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      message: "An error has occurred on the server.",
    });
  } finally {
    User.findUserByCredentials = originalFind;
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
});
