var express = require('express');

exports.router = new express.Router();

exports.router.get('/', function (request, response) {
	response.end('hi');
});
