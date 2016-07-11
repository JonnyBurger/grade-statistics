'use strict';

var express = require('express');
var co = require('co');
var bodyParser = require('body-parser');
var db = require('./db');

exports.router = new express.Router();
exports.router.use(bodyParser.json());

exports.router.post('/', function (request, response) {
	return co(function *() {
		const payload = request.body;
		for (var i = 0; i < payload.grades.length; i++) {
			var {module, grade, semester} = payload.grades[i];
			yield db.insertStat(request.body.user, module, grade, semester);
		}
		successHandler(response);
	})
	.catch(err => errorHandler(response, err));
});

exports.router.get('/:module', function (request, response) {
	return co(function *() {
		var stats = yield db.getAllStats(request.params.module);
		successHandler(response, stats);
	})
	.catch(err => errorHandler(response, err));
});

exports.router.delete('/', function (request, response) {
	return co(function *() {
		const {student} = request.body;
		yield db.deleteUser(student);
		successHandler(response);
	})
	.catch(err => errorHandler(response, err));
});

function successHandler(response, data = {}) {
	response.json(Object.assign(data, {success: true}));
}

function errorHandler(response, error) {
	response.status(400).json({
		success: false,
		error: error.message
	});
}
