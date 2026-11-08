const ClothingItem = require("../models/clothingItem");
const { ForbiddenError } = require("../errors");

const getItems = (_req, res, next) =>
  ClothingItem.find({})
    .then((items) => res.send(items))
    .catch(next);

const createClothingItem = (req, res, next) => {
  const { name, weather, imageUrl } = req.body || {};
  return ClothingItem.create({ name, weather, imageUrl, owner: req.user._id })
    .then((item) => res.status(201).send(item))
    .catch(next);
};

const deleteClothingItem = (req, res, next) =>
  ClothingItem.findById(req.params.itemId)
    .orFail()
    .then((item) => {
      if (!item.owner.equals(req.user._id)) {
        throw new ForbiddenError("You cannot delete another user's item");
      }
      return ClothingItem.findByIdAndDelete(req.params.itemId).orFail();
    })
    .then((item) => res.send(item))
    .catch(next);

const likeClothingItem = (req, res, next) =>
  ClothingItem.findByIdAndUpdate(
    req.params.itemId,
    { $addToSet: { likes: req.user._id } },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((item) => res.send(item))
    .catch(next);

const unlikeClothingItem = (req, res, next) =>
  ClothingItem.findByIdAndUpdate(
    req.params.itemId,
    { $pull: { likes: req.user._id } },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((item) => res.send(item))
    .catch(next);

module.exports = {
  getItems,
  createClothingItem,
  deleteClothingItem,
  likeClothingItem,
  unlikeClothingItem,
};
