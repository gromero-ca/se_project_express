const ClothingItem = require("../models/clothingItem");
const { BAD_REQUEST, NOT_FOUND, sendServerError } = require("../utils/errors");

const getItems = (_req, res) => {
  ClothingItem.find({})
    .then((items) => res.send(items))
    .catch((error) => sendServerError(res, error));
};

const createClothingItem = (req, res) => {
  const { name, weather, imageUrl } = req.body || {};

  ClothingItem.create({
    name,
    weather,
    imageUrl,
    owner: req.user._id,
  })
    .then((item) => res.status(201).send(item))
    .catch((error) => {
      if (error.name === "ValidationError") {
        return res.status(BAD_REQUEST).send({
          message: "Invalid data passed to the method for creating an item",
        });
      }

      return sendServerError(res, error);
    });
};

const deleteClothingItem = (req, res) => {
  ClothingItem.findByIdAndDelete(req.params.itemId)
    .orFail()
    .then((item) => res.send(item))
    .catch((error) => {
      if (error.name === "CastError") {
        return res.status(BAD_REQUEST).send({ message: "Invalid item id" });
      }

      if (error.name === "DocumentNotFoundError") {
        return res.status(NOT_FOUND).send({ message: "Item not found" });
      }

      return sendServerError(res, error);
    });
};

const likeClothingItem = (req, res) => {
  ClothingItem.findByIdAndUpdate(
    req.params.itemId,
    { $addToSet: { likes: req.user._id } },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((item) => res.send(item))
    .catch((error) => {
      if (error.name === "CastError") {
        return res.status(BAD_REQUEST).send({ message: "Invalid item id" });
      }

      if (error.name === "ValidationError") {
        return res.status(BAD_REQUEST).send({
          message: "Invalid data passed to the method for updating an item",
        });
      }

      if (error.name === "DocumentNotFoundError") {
        return res.status(NOT_FOUND).send({ message: "Item not found" });
      }

      return sendServerError(res, error);
    });
};

const unlikeClothingItem = (req, res) => {
  ClothingItem.findByIdAndUpdate(
    req.params.itemId,
    { $pull: { likes: req.user._id } },
    { new: true, runValidators: true }
  )
    .orFail()
    .then((item) => res.send(item))
    .catch((error) => {
      if (error.name === "CastError") {
        return res.status(BAD_REQUEST).send({ message: "Invalid item id" });
      }

      if (error.name === "ValidationError") {
        return res.status(BAD_REQUEST).send({
          message: "Invalid data passed to the method for updating an item",
        });
      }

      if (error.name === "DocumentNotFoundError") {
        return res.status(NOT_FOUND).send({ message: "Item not found" });
      }

      return sendServerError(res, error);
    });
};

module.exports = {
  getItems,
  createClothingItem,
  deleteClothingItem,
  likeClothingItem,
  unlikeClothingItem,
};
