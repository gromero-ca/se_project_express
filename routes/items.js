const router = require("express").Router();
const {
  getItems,
  createClothingItem,
  deleteClothingItem,
  likeClothingItem,
  unlikeClothingItem,
} = require("../controllers/clothingItems");

router.get("/", getItems);
router.post("/", createClothingItem);
router.put("/:itemId/likes", likeClothingItem);
router.delete("/:itemId/likes", unlikeClothingItem);
router.delete("/:itemId", deleteClothingItem);

module.exports = router;
