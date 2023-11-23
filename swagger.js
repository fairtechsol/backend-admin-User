
const swaggerAutogen = require('swagger-autogen')()
const fs= require('fs')
const outputFile = './swagger_output.json'

const routeFolder = ['./index.js'];
const doc = {
    info: {
      title: 'betFair-APIs',
      description: 'bet Fair APIs Description',
      version: '1.0.0',
    },
    host: 'localhost:5000',
    basePath: '/', 
    schemes: ['http','https'],
  };
console.log("Generating docs from above files..", routeFolder)
swaggerAutogen(outputFile,routeFolder,doc)