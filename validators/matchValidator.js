const Joi = require("joi");

module.exports.addMatchValidate = Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required().messages({
        "any.required": "Match id is required",
      }),
    matchType: Joi.string().required().messages({
      "string.base": "Match type must be a string",
      "any.required": "Match type is required",
    }),
    competitionId: Joi.string().required().messages({
      "string.base": "Competition ID must be a string",
      "any.required": "Competition ID is required",
    }),
    competitionName: Joi.string().required().messages({
      "string.base": "Competition name must be a string",
      "any.required": "Competition name is required",
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
    teamB: Joi.string().required().messages({
      "string.base": "Team B must be a string",
      "any.required": "Team B is required",
    }),
    teamC: Joi.string().trim().allow("").allow(null).messages({
      "string.base": "Team C must be a string",
    }),
    startAt: Joi.date().required().messages({
      "date.base": "Start date must be a valid date",
      "any.required": "Start date is required",
    }),
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
      "date.base": "Start date must be a valid date",
      "any.required": "Start date is required",
    }),
    competitionId: Joi.string().required().messages({
      "string.base": "Competition ID must be a string",
      "any.required": "Competition ID is required",
    }),
    competitionName: Joi.string().required().messages({
      "string.base": "Competition name must be a string",
      "any.required": "Competition name is required",
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
      "string.base": "venue must be a string",
      "any.required": "venue is required",
    }),
    raceType: Joi.string().required().messages({
      "string.base": "raceType must be a string",
      "any.required": "raceType is required",
    }),
    countryCode: Joi.string().required().messages({
      "string.base": "countryCode must be a string",
      "any.required": "countryCode is required",
    }),
    createdAt: Joi.date().required().messages({
        "date.base": "Created at date must be a valid date",
        "any.required": "Created at date is required",
      })
  }).messages({
    "object.base": "Invalid input. Please provide a valid object.",
  });
  