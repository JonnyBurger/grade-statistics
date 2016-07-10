var express = require('express');

exports.router = express.Router();

exports.router.get('/', function (request, response) {
	response.end('hi');
});
