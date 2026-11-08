const router = require("express").Router();
const auth = require("../middlewares/auth");
const validation = require("../middlewares/validation");
const {
  createClothingItem,
  deleteClothingItem,
  likeClothingItem,
  unlikeClothingItem,
} = require("../controllers/clothingItems");

router.post("/", auth, validation.item, createClothingItem);
router.put("/:itemId/likes", auth, validation.itemId, likeClothingItem);
router.delete("/:itemId/likes", auth, validation.itemId, unlikeClothingItem);
router.delete("/:itemId", auth, validation.itemId, deleteClothingItem);

module.exports = router;
