'use strict';

var express = require('express');
var co = require('co');
var bodyParser = require('body-parser');
var db = require('./db');
var handleRepeatedExams = require('./handle-repeat-exams');

exports.router = new express.Router();
exports.router.use(bodyParser.json());

exports.router.post('/', function (request, response) {
	return co(function *() {
		const payload = request.body;
		payload.grades = handleRepeatedExams(payload.grades);
		for (var i = 0; i < payload.grades.length; i++) {
			var {module, grade, semester, repeated} = payload.grades[i];
			yield db.insertStat(request.body.user, module, grade, semester, repeated);
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

exports.router.post('/opted-in', function (request, response) {
	return co(function *() {
		var optedIn = yield db.studentIsOptedIn(request.body.user);
		successHandler(response, {optedIn});
	})
	.catch(err => errorHandler(response, err));
});

exports.router.delete('/', function (request, response) {
	return co(function *() {
		const {user} = request.body;
		yield db.deleteUser(user);
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
