const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const http = require("node:http");
const mongoose = require("mongoose");
const test = require("node:test");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const auth = require("../middlewares/auth");
const User = require("../models/user");
const ClothingItem = require("../models/clothingItem");
const {
  createUser,
  getCurrentUser,
  updateCurrentUser,
  login,
} = require("../controllers/users");
const {
  createClothingItem,
  deleteClothingItem,
  likeClothingItem,
  unlikeClothingItem,
} = require("../controllers/clothingItems");
const { JWT_SECRET } = require("../utils/config");

test("JWT secret uses a dev fallback and is required in production", () => {
  const readSecret = (nodeEnv, secret) => {
    const environment = { ...process.env, NODE_ENV: nodeEnv };

    if (secret === undefined) {
      delete environment.JWT_SECRET;
    } else {
      environment.JWT_SECRET = secret;
    }

    return spawnSync(
      process.execPath,
      ["-e", 'process.stdout.write(require("./utils/config").JWT_SECRET);'],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: environment,
      }
    );
  };

  const development = readSecret("development");
  assert.equal(development.status, 0);
  assert.equal(development.stdout, "development-secret-key");

  const productionWithoutSecret = readSecret("production");
  assert.notEqual(productionWithoutSecret.status, 0);
  assert.match(productionWithoutSecret.stderr, /JWT_SECRET must be set/);

  const productionWithEmptySecret = readSecret("production", "");
  assert.notEqual(productionWithEmptySecret.status, 0);
  assert.match(productionWithEmptySecret.stderr, /JWT_SECRET must be set/);

  const productionWithSecret = readSecret("production", "production-secret");
  assert.equal(productionWithSecret.status, 0);
  assert.equal(productionWithSecret.stdout, "production-secret");
});

const originalConnect = mongoose.connect;
mongoose.connect = () => new Promise(() => {});

const app = require("../app");

mongoose.connect = originalConnect;

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

const createQuery = (result) => {
  const promise = Promise.resolve(result);
  promise.orFail = () => promise;
  return promise;
};

const createFailedQuery = (error) => {
  const promise = Promise.reject(error);
  promise.orFail = () => promise;
  return promise;
};

const withServer = async (callback) => {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, resolve);
  });

  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
};

test("authorization rejects requests without a bearer token", () => {
  const res = createResponse();
  let nextCalled = false;

  auth({ headers: {} }, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(typeof res.body.message, "string");
  assert.equal(nextCalled, false);
});

test("authorization adds a verified token payload to the request", () => {
  const userId = "5d8b8592978f8bd833ca8133";
  const payload = { _id: userId };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = createResponse();
  let nextCalled = false;

  auth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(req.user._id, userId);
  assert.equal(req.user.exp - req.user.iat, 7 * 24 * 60 * 60);
  assert.deepEqual(Object.keys(req.user).sort(), ["_id", "exp", "iat"]);
  assert.equal(nextCalled, true);
});

test("authorization rejects an invalid token", () => {
  const res = createResponse();

  auth({ headers: { authorization: "Bearer invalid" } }, res, () => {});

  assert.equal(res.statusCode, 401);
  assert.equal(typeof res.body.message, "string");
});

test("user credentials are checked against the selected password hash", async () => {
  const password = "correct-password";
  const hash = await bcrypt.hash(password, 4);
  const originalFindOne = User.findOne;
  let selectedFields;

  User.findOne = () => ({
    select(fields) {
      selectedFields = fields;
      return Promise.resolve({ email: "person@example.com", password: hash });
    },
  });

  try {
    const user = await User.findUserByCredentials(
      "person@example.com",
      password
    );

    assert.equal(selectedFields, "+password");
    assert.equal(user.email, "person@example.com");
    await assert.rejects(
      User.findUserByCredentials("person@example.com", "wrong-password"),
      { statusCode: 401 }
    );
  } finally {
    User.findOne = originalFindOne;
  }
});

test("user schema requires unique email and hides its password hash", () => {
  assert.equal(User.schema.path("email").options.required, true);
  assert.equal(User.schema.path("email").options.unique, true);
  assert.equal(User.schema.path("email").options.sparse, true);
  assert.equal(User.schema.path("password").options.required, true);
  assert.equal(User.schema.path("password").options.select, false);
});

test("current user controller reads the authenticated user id", async () => {
  const originalFindById = User.findById;
  const user = { _id: "5d8b8592978f8bd833ca8133", name: "Test User" };
  let requestedId;
  const res = createResponse();
  User.findById = (id) => {
    requestedId = id;
    return createQuery(user);
  };

  try {
    await getCurrentUser({ user: { _id: user._id } }, res);
    assert.equal(requestedId, user._id);
    assert.equal(res.body, user);
  } finally {
    User.findById = originalFindById;
  }
});

test("profile update changes only name and avatar with validators enabled", async () => {
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const id = "5d8b8592978f8bd833ca8133";
  const user = {
    _id: id,
    name: "Updated User",
    avatar: "https://example.com/new.png",
  };
  let updateArgs;
  const res = createResponse();
  User.findByIdAndUpdate = (...args) => {
    updateArgs = args;
    return createQuery(user);
  };

  try {
    await updateCurrentUser(
      {
        user: { _id: id },
        body: {
          name: user.name,
          avatar: user.avatar,
          email: "new@example.com",
        },
      },
      res
    );
    assert.equal(updateArgs[0], id);
    assert.deepEqual(updateArgs[1], { name: user.name, avatar: user.avatar });
    assert.deepEqual(updateArgs[2], { new: true, runValidators: true });
    assert.equal(res.body, user);
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("profile update maps validation errors to 400", async () => {
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  const res = createResponse();
  const error = Object.assign(new Error("invalid profile"), {
    name: "ValidationError",
  });
  User.findByIdAndUpdate = () => createFailedQuery(error);

  try {
    await updateCurrentUser(
      { user: { _id: "5d8b8592978f8bd833ca8133" }, body: { name: "x" } },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.body), ["message"]);
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("signup hashes the password and omits it from the response", async () => {
  const originalCreate = User.create;
  let createdData;
  const res = createResponse();

  User.create = async (data) => {
    createdData = data;
    return {
      toObject: () => ({ ...data, _id: "5d8b8592978f8bd833ca8133" }),
    };
  };

  try {
    await createUser(
      {
        body: {
          name: "Test User",
          avatar: "https://example.com/avatar.png",
          email: "person@example.com",
          password: "correct-password",
        },
      },
      res
    );

    assert.notEqual(createdData.password, "correct-password");
    assert.equal(
      await bcrypt.compare("correct-password", createdData.password),
      true
    );
    assert.equal(res.statusCode, 201);
    assert.equal("password" in res.body, false);
  } finally {
    User.create = originalCreate;
  }
});

test("signup rejects an empty password before hashing or saving", async () => {
  const originalCreate = User.create;
  const res = createResponse();
  let createCalled = false;
  User.create = async () => {
    createCalled = true;
  };

  try {
    await createUser(
      { body: { email: "person@example.com", password: "" } },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.deepEqual(Object.keys(res.body), ["message"]);
    assert.equal(createCalled, false);
  } finally {
    User.create = originalCreate;
  }
});

test("signup returns 409 when the email already exists", async () => {
  const originalCreate = User.create;
  const res = createResponse();
  User.create = async () => {
    const error = new Error("duplicate email");
    error.code = 11000;
    throw error;
  };

  try {
    await createUser(
      {
        body: {
          name: "Test User",
          avatar: "https://example.com/avatar.png",
          email: "person@example.com",
          password: "secret",
        },
      },
      res
    );
    assert.equal(res.statusCode, 409);
    assert.deepEqual(Object.keys(res.body), ["message"]);
  } finally {
    User.create = originalCreate;
  }
});

test("item deletion rejects a user who does not own the item", async () => {
  const originalFindById = ClothingItem.findById;
  const originalFindByIdAndDelete = ClothingItem.findByIdAndDelete;
  const ownerId = "owner-id";
  const item = { owner: { equals: (id) => id === ownerId } };
  const res = createResponse();
  let deleteCalled = false;
  ClothingItem.findById = () => createQuery(item);
  ClothingItem.findByIdAndDelete = () => {
    deleteCalled = true;
    return Promise.resolve(item);
  };

  try {
    await deleteClothingItem(
      {
        params: { itemId: "5d8b8592978f8bd833ca8133" },
        user: { _id: "another-user" },
      },
      res
    );
    assert.equal(res.statusCode, 403);
    assert.deepEqual(Object.keys(res.body), ["message"]);
    assert.equal(deleteCalled, false);
  } finally {
    ClothingItem.findById = originalFindById;
    ClothingItem.findByIdAndDelete = originalFindByIdAndDelete;
  }
});

test("item owner can delete their item", async () => {
  const originalFindById = ClothingItem.findById;
  const originalFindByIdAndDelete = ClothingItem.findByIdAndDelete;
  const ownerId = "owner-id";
  const item = {
    _id: "5d8b8592978f8bd833ca8133",
    owner: { equals: (id) => id === ownerId },
  };
  const res = createResponse();
  let deletedId;
  ClothingItem.findById = () => createQuery(item);
  ClothingItem.findByIdAndDelete = (id) => {
    deletedId = id;
    return createQuery(item);
  };

  try {
    await deleteClothingItem(
      { params: { itemId: item._id }, user: { _id: ownerId } },
      res
    );
    assert.equal(deletedId, item._id);
    assert.equal(res.body, item);
  } finally {
    ClothingItem.findById = originalFindById;
    ClothingItem.findByIdAndDelete = originalFindByIdAndDelete;
  }
});

test("item deletion returns 404 if the item disappears before deletion", async () => {
  const originalFindById = ClothingItem.findById;
  const originalFindByIdAndDelete = ClothingItem.findByIdAndDelete;
  const ownerId = "owner-id";
  const item = { owner: { equals: (id) => id === ownerId } };
  const missingError = Object.assign(new Error("missing item"), {
    name: "DocumentNotFoundError",
  });
  const res = createResponse();
  ClothingItem.findById = () => createQuery(item);
  ClothingItem.findByIdAndDelete = () => {
    const query = Promise.resolve(null);
    query.orFail = () => createFailedQuery(missingError);
    return query;
  };

  try {
    await deleteClothingItem(
      {
        params: { itemId: "5d8b8592978f8bd833ca8133" },
        user: { _id: ownerId },
      },
      res
    );
    assert.equal(res.statusCode, 404);
    assert.deepEqual(Object.keys(res.body), ["message"]);
  } finally {
    ClothingItem.findById = originalFindById;
    ClothingItem.findByIdAndDelete = originalFindByIdAndDelete;
  }
});

test("item deletion maps malformed ids and missing items to 400 and 404", async () => {
  const originalFindById = ClothingItem.findById;
  const res = createResponse();

  try {
    const castError = Object.assign(new Error("invalid id"), {
      name: "CastError",
    });
    ClothingItem.findById = () => createFailedQuery(castError);
    await deleteClothingItem(
      { params: { itemId: "invalid" }, user: { _id: "user-id" } },
      res
    );
    assert.equal(res.statusCode, 400);

    res.statusCode = 200;
    res.body = null;
    const missingError = Object.assign(new Error("missing item"), {
      name: "DocumentNotFoundError",
    });
    ClothingItem.findById = () => createFailedQuery(missingError);
    await deleteClothingItem(
      {
        params: { itemId: "5d8b8592978f8bd833ca8133" },
        user: { _id: "user-id" },
      },
      res
    );
    assert.equal(res.statusCode, 404);
    assert.deepEqual(Object.keys(res.body), ["message"]);
  } finally {
    ClothingItem.findById = originalFindById;
  }
});

test("item creation uses the authenticated user as its owner", async () => {
  const originalCreate = ClothingItem.create;
  const userId = "5d8b8592978f8bd833ca8133";
  const item = { _id: "5d8b8592978f8bd833ca8144", owner: userId };
  const res = createResponse();
  let createdData;
  ClothingItem.create = async (data) => {
    createdData = data;
    return item;
  };

  try {
    await createClothingItem(
      {
        user: { _id: userId },
        body: {
          name: "Jacket",
          weather: "cold",
          imageUrl: "https://example.com/jacket.png",
        },
      },
      res
    );
    assert.equal(createdData.owner, userId);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body, item);
  } finally {
    ClothingItem.create = originalCreate;
  }
});

test("like and unlike update the item and return the updated document", async () => {
  const originalFindByIdAndUpdate = ClothingItem.findByIdAndUpdate;
  const userId = "5d8b8592978f8bd833ca8133";
  const itemId = "5d8b8592978f8bd833ca8144";
  const item = { _id: itemId, likes: [userId] };
  const req = { params: { itemId }, user: { _id: userId } };
  const likeRes = createResponse();
  const unlikeRes = createResponse();
  const updates = [];
  ClothingItem.findByIdAndUpdate = (...args) => {
    updates.push(args);
    return createQuery(item);
  };

  try {
    await likeClothingItem(req, likeRes);
    await unlikeClothingItem(req, unlikeRes);
    assert.deepEqual(updates[0][1], { $addToSet: { likes: userId } });
    assert.deepEqual(updates[1][1], { $pull: { likes: userId } });
    assert.deepEqual(updates[0][2], { new: true, runValidators: true });
    assert.deepEqual(updates[1][2], { new: true, runValidators: true });
    assert.equal(likeRes.body, item);
    assert.equal(unlikeRes.body, item);
  } finally {
    ClothingItem.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test("login returns a seven-day JWT with only the user id in its payload", async () => {
  const originalFindUserByCredentials = User.findUserByCredentials;
  const res = createResponse();
  User.findUserByCredentials = async () => ({
    _id: "5d8b8592978f8bd833ca8133",
    email: "person@example.com",
  });

  try {
    await login(
      { body: { email: "person@example.com", password: "secret" } },
      res
    );

    const payload = jwt.verify(res.body.token, JWT_SECRET);
    assert.deepEqual(Object.keys(payload).sort(), ["_id", "exp", "iat"]);
    assert.equal(payload._id, "5d8b8592978f8bd833ca8133");
    assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);
    assert.equal(res.statusCode, 200);
  } finally {
    User.findUserByCredentials = originalFindUserByCredentials;
  }
});

test("login returns 401 for incorrect credentials", async () => {
  const originalFindUserByCredentials = User.findUserByCredentials;
  const res = createResponse();
  User.findUserByCredentials = async () => {
    const error = new Error("Incorrect email or password");
    error.statusCode = 401;
    throw error;
  };

  try {
    await login(
      { body: { email: "person@example.com", password: "wrong" } },
      res
    );
    assert.equal(res.statusCode, 401);
    assert.deepEqual(Object.keys(res.body), ["message"]);
  } finally {
    User.findUserByCredentials = originalFindUserByCredentials;
  }
});

test("signin rejects missing or empty email and password with 400", async () => {
  const originalFindUserByCredentials = User.findUserByCredentials;
  User.findUserByCredentials = async () => {
    const error = new Error("Incorrect email or password");
    error.statusCode = 401;
    throw error;
  };

  try {
    await withServer(async (url) => {
      const bodies = [
        {},
        { password: "secret" },
        { email: "person@example.com" },
        { email: "", password: "secret" },
        { email: "person@example.com", password: "" },
      ];
      const responses = await Promise.all(
        bodies.map((body) =>
          fetch(`${url}/signin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        )
      );

      await Promise.all(
        responses.map(async (response) => {
          assert.equal(response.status, 400);
          assert.deepEqual(await response.json(), {
            message: "Email and password are required",
          });
        })
      );
    });
  } finally {
    User.findUserByCredentials = originalFindUserByCredentials;
  }
});

test("public routes stay public and protected item routes reject missing tokens", async () => {
  const originalUserCreate = User.create;
  const originalFindUserByCredentials = User.findUserByCredentials;
  const originalClothingFind = ClothingItem.find;
  const userId = "5d8b8592978f8bd833ca8133";
  User.create = async (data) => ({
    toObject: () => ({ ...data, _id: userId }),
  });
  User.findUserByCredentials = async () => ({ _id: userId });
  ClothingItem.find = () => Promise.resolve([]);

  try {
    await withServer(async (url) => {
      const signupResponse = await fetch(`${url}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test User",
          avatar: "https://example.com/avatar.png",
          email: "person@example.com",
          password: "secret",
        }),
      });
      assert.equal(signupResponse.status, 201);
      assert.equal("password" in (await signupResponse.json()), false);

      const signinResponse = await fetch(`${url}/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "person@example.com",
          password: "secret",
        }),
      });
      assert.equal(signinResponse.status, 200);
      assert.equal(typeof (await signinResponse.json()).token, "string");

      const publicItemsResponse = await fetch(`${url}/items`);
      assert.equal(publicItemsResponse.status, 200);
      assert.deepEqual(await publicItemsResponse.json(), []);

      const protectedRequests = [
        fetch(`${url}/users/me`),
        fetch(`${url}/items`, { method: "POST" }),
        fetch(`${url}/items/5d8b8592978f8bd833ca8144`, { method: "DELETE" }),
        fetch(`${url}/items/5d8b8592978f8bd833ca8144/likes`, { method: "PUT" }),
        fetch(`${url}/items/5d8b8592978f8bd833ca8144/likes`, {
          method: "DELETE",
        }),
      ];
      const responses = await Promise.all(protectedRequests);
      assert.deepEqual(
        responses.map((response) => response.status),
        [401, 401, 401, 401, 401]
      );

      const protectedBody = await responses[0].json();
      assert.deepEqual(Object.keys(protectedBody), ["message"]);

      const missingResponse = await fetch(`${url}/not-a-route`);
      const missingBody = await missingResponse.json();
      assert.equal(missingResponse.status, 404);
      assert.deepEqual(Object.keys(missingBody), ["message"]);
    });
  } finally {
    User.create = originalUserCreate;
    User.findUserByCredentials = originalFindUserByCredentials;
    ClothingItem.find = originalClothingFind;
  }
});

test("valid bearer token can use profile and item routes over HTTP", async () => {
  const originalUserFindById = User.findById;
  const originalUserFindByIdAndUpdate = User.findByIdAndUpdate;
  const originalItemCreate = ClothingItem.create;
  const originalItemFindById = ClothingItem.findById;
  const originalItemFindByIdAndUpdate = ClothingItem.findByIdAndUpdate;
  const originalItemFindByIdAndDelete = ClothingItem.findByIdAndDelete;
  const userId = "5d8b8592978f8bd833ca8133";
  const itemId = "5d8b8592978f8bd833ca8144";
  const token = jwt.sign({ _id: userId }, JWT_SECRET, { expiresIn: "7d" });
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  let profile = {
    _id: userId,
    name: "Test User",
    avatar: "https://example.com/avatar.png",
  };
  const storedItem = {
    _id: itemId,
    owner: { equals: (id) => id === userId },
    likes: [],
  };

  User.findById = (id) => {
    assert.equal(id, userId);
    return createQuery(profile);
  };
  User.findByIdAndUpdate = (id, update) => {
    assert.equal(id, userId);
    profile = { ...profile, ...update };
    return createQuery(profile);
  };
  ClothingItem.create = async (data) => ({
    ...data,
    _id: itemId,
    likes: [],
  });
  ClothingItem.findById = (id) => {
    assert.equal(id, itemId);
    return createQuery(storedItem);
  };
  ClothingItem.findByIdAndUpdate = (_id, update) => {
    if (update.$addToSet) {
      storedItem.likes.push(update.$addToSet.likes);
    } else {
      storedItem.likes = storedItem.likes.filter(
        (like) => like !== update.$pull.likes
      );
    }
    return createQuery({ ...storedItem, likes: [...storedItem.likes] });
  };
  ClothingItem.findByIdAndDelete = (id) => {
    assert.equal(id, itemId);
    return createQuery(storedItem);
  };

  try {
    await withServer(async (url) => {
      const profileResponse = await fetch(`${url}/users/me`, { headers });
      assert.equal(profileResponse.status, 200);
      assert.equal((await profileResponse.json())._id, userId);

      const updateResponse = await fetch(`${url}/users/me`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ name: "Updated User" }),
      });
      assert.equal(updateResponse.status, 200);
      assert.equal((await updateResponse.json()).name, "Updated User");

      const createItemResponse = await fetch(`${url}/items`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Jacket",
          weather: "cold",
          imageUrl: "https://example.com/jacket.png",
        }),
      });
      assert.equal(createItemResponse.status, 201);
      assert.equal((await createItemResponse.json()).owner, userId);

      const likeResponse = await fetch(`${url}/items/${itemId}/likes`, {
        method: "PUT",
        headers,
      });
      assert.equal(likeResponse.status, 200);
      assert.deepEqual((await likeResponse.json()).likes, [userId]);

      const unlikeResponse = await fetch(`${url}/items/${itemId}/likes`, {
        method: "DELETE",
        headers,
      });
      assert.equal(unlikeResponse.status, 200);
      assert.deepEqual((await unlikeResponse.json()).likes, []);

      const deleteResponse = await fetch(`${url}/items/${itemId}`, {
        method: "DELETE",
        headers,
      });
      assert.equal(deleteResponse.status, 200);
      assert.equal((await deleteResponse.json())._id, itemId);
    });
  } finally {
    User.findById = originalUserFindById;
    User.findByIdAndUpdate = originalUserFindByIdAndUpdate;
    ClothingItem.create = originalItemCreate;
    ClothingItem.findById = originalItemFindById;
    ClothingItem.findByIdAndUpdate = originalItemFindByIdAndUpdate;
    ClothingItem.findByIdAndDelete = originalItemFindByIdAndDelete;
  }
});

test("CORS preflight succeeds and malformed JSON returns a quiet 400", async () => {
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...args) => loggedErrors.push(args);

  try {
    await withServer(async (url) => {
      const preflightResponse = await fetch(`${url}/users/me`, {
        method: "OPTIONS",
        headers: {
          Origin: "https://client.example.com",
          "Access-Control-Request-Method": "GET",
        },
      });
      assert.equal(preflightResponse.status, 204);
      assert.equal(
        preflightResponse.headers.get("access-control-allow-origin"),
        "*"
      );

      const malformedResponse = await fetch(`${url}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      assert.equal(malformedResponse.status, 400);
      assert.deepEqual(Object.keys(await malformedResponse.json()), [
        "message",
      ]);
      assert.deepEqual(loggedErrors, []);
    });
  } finally {
    console.error = originalConsoleError;
  }
});

test("invalid and expired bearer tokens are rejected", async () => {
  const expiredToken = jwt.sign(
    { _id: "5d8b8592978f8bd833ca8133" },
    JWT_SECRET,
    { expiresIn: -1 }
  );

  await withServer(async (url) => {
    const tokenResponses = await Promise.all(
      ["invalid-token", expiredToken].map((token) =>
        fetch(`${url}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
    );
    const tokenBodies = await Promise.all(
      tokenResponses.map((response) => response.json())
    );

    tokenResponses.forEach((response, index) => {
      assert.equal(response.status, 401);
      assert.deepEqual(Object.keys(tokenBodies[index]), ["message"]);
    });

    const missingResponse = await fetch(`${url}/not-a-route`);
    const missingBody = await missingResponse.json();
    assert.equal(missingResponse.status, 404);
    assert.deepEqual(Object.keys(missingBody), ["message"]);
  });
});
