const Joi = require("joi");

module.exports.addMatchValidate = Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required().messages({
        "any.required": "Match id is required",
      }),
    matchType: Joi.string().required().messages({
      "string.base": "Match type must be a string",
      "any.required": "Match type is required",
    }),
    competitionId: Joi.string().allow(null).messages({
      "string.base": "Competition ID must be a string",
    }),
    competitionName: Joi.string().allow(null).messages({
      "string.base": "Competition name must be a string",
    }),
    title: Joi.string().required().messages({
      "string.base": "Title must be a string",
      "any.required": "Title is required",
    }),
    marketId: Joi.string().required().messages({
      "string.base": "Market ID must be a string",
      "any.required": "Market ID is required",
    }),
    eventId: Joi.string().required().messages({
      "string.base": "Event ID must be a string",
      "any.required": "Event ID is required",
    }),
    teamA: Joi.string().required().messages({
      "string.base": "Team A must be a string",
      "any.required": "Team A is required",
    }),
    teamB: Joi.string().trim().allow("").allow(null).messages({
      "string.base": "Team B must be a string",
    }),
    teamC: Joi.string().trim().allow("").allow(null).messages({
      "string.base": "Team C must be a string",
    }),
    startAt: Joi.date().required().messages({
      "date.base": "Start date must be a valid date",
      "any.required": "Start date is required",
    }),
  isTv: Joi.boolean().allow(null),
  isFancy: Joi.boolean().allow(null),
  isBookmaker: Joi.boolean().allow(null),
  createdAt: Joi.date().required().messages({
    "date.base": "Created at date must be a valid date",
    "any.required": "Created at date is required",
  })
  }).messages({
    "object.base": "Invalid input. Please provide a valid object.",
  });



  module.exports.addRaceValidate = Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required().messages({
        "any.required": "Match id is required",
      }),
    matchType: Joi.string().required().messages({
      "string.base": "Match type must be a string",
      "any.required": "Match type is required",
    }),
    createBy: Joi.string().required().messages({
      "string.base": "Create By must be a valid userId",
      "any.required": "Create By is required",
    }),
    title: Joi.string().required().messages({
      "string.base": "Title must be a string",
      "any.required": "Title is required",
    }),
    marketId: Joi.string().required().messages({
      "string.base": "Market ID must be a string",
      "any.required": "Market ID is required",
    }),
    eventId: Joi.string().required().messages({
      "string.base": "Event ID must be a string",
      "any.required": "Event ID is required",
    }),
    startAt: Joi.date().required().messages({
      "date.base": "Start date must be a valid date",
      "any.required": "Start date is required",
    }),
    venue: Joi.string().required().messages({
      "string.base": "Venue must be a string",
      "any.required": "Venue is required",
    }),
    raceType: Joi.string().required().messages({
      "string.base": "Race Type must be a string",
      "any.required": "Race Type  is required",
    }),
    countryCode: Joi.string().required().messages({
      "string.base": "Country Code must be a string",
      "any.required": "Country Code is required",
    }),
    createdAt: Joi.date().required().messages({
        "date.base": "Created at date must be a valid date",
        "any.required": "Created at date is required",
      })
  }).messages({
    "object.base": "Invalid input. Please provide a valid object.",
  });
  