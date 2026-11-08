const { celebrate, Joi, Segments } = require("celebrate");
const validator = require("validator");

const url = Joi.string().custom((value, helpers) =>
  validator.isURL(value) ? value : helpers.error("string.uri")
);
const name = Joi.string().min(2).max(30);
const email = Joi.string().custom((value, helpers) =>
  validator.isEmail(value) ? value : helpers.error("string.email")
);
const itemId = Joi.string().hex().length(24).required();

module.exports = {
  signup: celebrate({
    [Segments.BODY]: Joi.object({
      name: name.required(),
      avatar: url.required(),
      email: email.required(),
      password: Joi.string().required(),
    }).required(),
  }),
  signin: celebrate({
    [Segments.BODY]: Joi.object({
      email: Joi.string().required(),
      password: Joi.string().required(),
    }).required(),
  }),
  profile: celebrate({
    [Segments.BODY]: Joi.object({ name, avatar: url }).min(1).required(),
  }),
  item: celebrate({
    [Segments.BODY]: Joi.object({
      name: name.required(),
      weather: Joi.string().valid("hot", "warm", "cold").required(),
      imageUrl: url.required(),
    }).required(),
  }),
  itemId: celebrate({ [Segments.PARAMS]: Joi.object({ itemId }).required() }),
};
