const router = require("express").Router();
const usersRouter = require("./users");
const itemsRouter = require("./items");
const { createUser, login } = require("../controllers/users");
const { getItems } = require("../controllers/clothingItems");
const { NOT_FOUND } = require("../utils/errors");

router.post("/signup", createUser);
router.post("/signin", login);
router.get("/items", getItems);
router.use("/users", usersRouter);
router.use("/items", itemsRouter);

router.use((_req, res) => {
  res.status(NOT_FOUND).send({ message: "Requested resource not found" });
});

module.exports = router;
