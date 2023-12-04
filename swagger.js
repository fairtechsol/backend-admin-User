
const swaggerAutogen = require('swagger-autogen')({openapi: '3.0.0'})
const fs= require('fs')
const outputFile = './swagger_output.json'

const routeFolder = ['./index.js'];
const doc = {
    info: {
      title: 'betFair-APIs',
      description: 'bet Fair APIs Description',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:5000', 
        description: 'local host url ' 
      },
      {
        url: 'http://development.com', 
        description: 'development url ' 
      },
      {
        url: 'https://production.com', 
        description: 'production url ' 
      }
    ],
    basePath: '/', 
    schemes: ['http','https'],
  };
console.log("Generating docs from above files..", routeFolder)
swaggerAutogen(outputFile,routeFolder,doc)