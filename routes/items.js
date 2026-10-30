const router = require("express").Router();
const auth = require("../middlewares/auth");
const {
  createClothingItem,
  deleteClothingItem,
  likeClothingItem,
  unlikeClothingItem,
} = require("../controllers/clothingItems");

router.post("/", auth, createClothingItem);
router.put("/:itemId/likes", auth, likeClothingItem);
router.delete("/:itemId/likes", auth, unlikeClothingItem);
router.delete("/:itemId", auth, deleteClothingItem);

module.exports = router;
