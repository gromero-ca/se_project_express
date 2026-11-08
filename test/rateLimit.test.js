const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const express = require("express");
const User = require("../models/user");
const createAuthLimiters = require("../middlewares/rateLimit");
const errorHandler = require("../middlewares/error");

process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "wtwr-rate-limit-")));
const originalConnect = mongoose.connect;
mongoose.connect = () => new Promise(() => {});
const app = require("../app");

mongoose.connect = originalConnect;

const withServer = async (callback, target = app) => {
  const server = http.createServer(target);
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }
};

const signin = (baseUrl, email, clientIp, forwarded = clientIp) =>
  fetch(`${baseUrl}/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": forwarded,
      "X-Real-IP": clientIp,
    },
    body: JSON.stringify({ email, password: "test-password" }),
  });

test("signin bounds account guesses across source IPs and email variants", async () => {
  const originalFind = User.findUserByCredentials;
  const receivedEmails = [];
  User.findUserByCredentials = async (email) => {
    receivedEmails.push(email);
    if (email === "other@example.com") {
      return { _id: "5d8b8592978f8bd833ca8133" };
    }
    const error = new Error("Incorrect email or password");
    error.statusCode = 401;
    throw error;
  };
  try {
    await withServer(async (baseUrl) => {
      await Promise.all(
        Array.from({ length: 10 }, async (_value, attempt) => {
          const email =
            attempt % 2 ? " GUESS@example.com " : "guess@example.com";
          const response = await signin(
            baseUrl,
            email,
            `203.0.113.${attempt + 1}`
          );
          assert.equal(response.status, 401);
        })
      );
      const blocked = await signin(
        baseUrl,
        "Guess@example.com",
        "198.51.100.1"
      );
      assert.equal(blocked.status, 429);
      assert.deepEqual(Object.keys(await blocked.json()), ["message"]);
      assert.ok(Number(blocked.headers.get("Retry-After")) > 0);
      assert.equal(receivedEmails.length, 10);
      assert.ok(receivedEmails.includes(" GUESS@example.com "));

      const legitimate = await signin(
        baseUrl,
        "other@example.com",
        "198.51.100.1"
      );
      assert.equal(legitimate.status, 200);
      assert.equal(typeof (await legitimate.json()).token, "string");
    });
  } finally {
    User.findUserByCredentials = originalFind;
  }
});

test("rotating emails and forged forwarded addresses cannot evade the client limit", async () => {
  const originalFind = User.findUserByCredentials;
  let credentialCalls = 0;
  User.findUserByCredentials = async () => {
    credentialCalls += 1;
    const error = new Error("Incorrect email or password");
    error.statusCode = 401;
    throw error;
  };
  try {
    await withServer(async (baseUrl) => {
      await Promise.all(
        Array.from({ length: 50 }, async (_value, attempt) => {
          const response = await signin(
            baseUrl,
            `rotation${attempt}@example.com`,
            `192.0.2.${attempt + 1}`,
            `192.0.2.${attempt + 1}, 198.51.100.50`
          );
          assert.equal(response.status, 401);
        })
      );
      const blocked = await signin(
        baseUrl,
        "rotation50@example.com",
        "192.0.2.100",
        "192.0.2.100, 198.51.100.50"
      );
      assert.equal(blocked.status, 429);
      assert.equal(credentialCalls, 50);

      const signup = await fetch(`${baseUrl}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.50",
        },
        body: JSON.stringify({}),
      });
      assert.equal(signup.status, 429);
      assert.deepEqual(Object.keys(await signup.json()), ["message"]);

      const profile = await fetch(`${baseUrl}/users/me`, {
        headers: { "X-Forwarded-For": "198.51.100.50" },
      });
      assert.equal(profile.status, 401);
      const unknown = await fetch(`${baseUrl}/unknown`, {
        headers: { "X-Forwarded-For": "198.51.100.50" },
      });
      assert.equal(unknown.status, 404);
    });
  } finally {
    User.findUserByCredentials = originalFind;
  }
});

test("successful signins keep their account quota and expired failures can retry", async () => {
  const target = express();
  const { authLimiter, signinLimiter } = createAuthLimiters({
    windowMs: 1000,
    ipLimit: 100,
    accountLimit: 1,
  });
  let authorized = true;
  target.set("trust proxy", "loopback");
  target.use(express.json());
  target.post("/signin", authLimiter, signinLimiter, (_req, res) =>
    res.status(authorized ? 200 : 401).send({ message: "Test response" })
  );
  target.use(errorHandler);
  await withServer(async (baseUrl) => {
    assert.equal(
      (await signin(baseUrl, "retry@example.com", "127.0.0.1")).status,
      200
    );
    assert.equal(
      (await signin(baseUrl, "retry@example.com", "127.0.0.1")).status,
      200
    );
    authorized = false;
    assert.equal(
      (await signin(baseUrl, "retry@example.com", "127.0.0.1")).status,
      401
    );
    assert.equal(
      (await signin(baseUrl, "retry@example.com", "127.0.0.1")).status,
      429
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });
    assert.equal(
      (await signin(baseUrl, "retry@example.com", "127.0.0.1")).status,
      401
    );
  }, target);
});

test("IPv6 rotation within the same client subnet shares the IP limit", async () => {
  const target = express();
  const { authLimiter } = createAuthLimiters({ ipLimit: 2 });
  target.set("trust proxy", "loopback");
  target.use(express.json());
  target.post("/signin", authLimiter, (_req, res) =>
    res.send({ token: "test" })
  );
  target.use(errorHandler);
  await withServer(async (baseUrl) => {
    assert.equal(
      (await signin(baseUrl, "ipv6@example.com", "2001:db8:abcd:1200::1"))
        .status,
      200
    );
    assert.equal(
      (await signin(baseUrl, "ipv6@example.com", "2001:db8:abcd:1201::2"))
        .status,
      200
    );
    assert.equal(
      (await signin(baseUrl, "ipv6@example.com", "2001:db8:abcd:12ff::3"))
        .status,
      429
    );
  }, target);
});
