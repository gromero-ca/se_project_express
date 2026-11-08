const router = require("express").Router();
const usersRouter = require("./users");
const itemsRouter = require("./items");
const { createUser, login } = require("../controllers/users");
const { getItems } = require("../controllers/clothingItems");
const { signup, signin } = require("../middlewares/validation");
const { BadRequestError, NotFoundError } = require("../errors");

router.post("/signup", signup, createUser);
router.post(
  "/signin",
  (req, _res, next) => {
    if (!req.body?.email || !req.body?.password) {
      return next(new BadRequestError("Email and password are required"));
    }
    return next();
  },
  signin,
  login
);
router.get("/items", getItems);
router.use("/users", usersRouter);
router.use("/items", itemsRouter);
router.use((_req, _res, next) =>
  next(new NotFoundError("Requested resource not found"))
);

module.exports = router;
