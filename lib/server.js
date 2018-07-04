'use strict';

var express = require('express');
var co = require('co');
var bodyParser = require('body-parser');
var db = require('./db');
var handleRepeatedExams = require('./handle-repeat-exams');
var {MAX_OPTOUTS} = require('./config');

exports.router = new express.Router();
exports.router.use(bodyParser.json());

const UZH = 'UZH';

exports.router.post('/', function (request, response) {
	return co(function *() {
		const payload = request.body;
		payload.grades = handleRepeatedExams(payload.grades);
		yield db.insertStats(payload.grades.map(g => ([
			request.body.user, g.module, g.grade, g.semester, g.repeated, request.body.institution || UZH
		])));
		successHandler(response);
	})
	.catch(err => errorHandler(response, err));
});

exports.router.get('/:institution(ETH|UZH)/:module', function (request, response) {
	return co(function *() {
		var stats = yield db.getAllStats(request.params.module, request.params.institution);
		successHandler(response, stats);
	})
	.catch(err => errorHandler(response, err));
});

exports.router.get('/:module', function (request, response) {
	return co(function *() {
		var stats = yield db.getAllStats(request.params.module, UZH);
		successHandler(response, stats);
	})
	.catch(err => errorHandler(response, err));
});

exports.router.post('/opted-in', function (request, response) {
	return co(function *() {
		var optedIn = yield db.studentIsOptedIn(request.body.user, request.body.institution || UZH);
		// var optOuts = yield db.studentOptOutCount(request.body.user, request.body.institution || UZH);

		successHandler(response, {
			optedIn,
			optOuts: 0,
			maxOptOuts: MAX_OPTOUTS
		});
	})
	.catch(err => errorHandler(response, err));
});

exports.router.delete('/', function (request, response) {
	return co(function *() {
		const {user, institution} = request.body;
		let optedIn = yield db.studentIsOptedIn(user, institution || UZH);
		if (optedIn) {
			const optOuts = yield db.studentOptOutCount(user, institution || UZH);
			if (optOuts >= MAX_OPTOUTS) {
				throw new Error('Maximale Anzahl an Opt-Outs erreicht.');
			}
			yield db.deleteUser(user, institution || UZH);
			yield db.addOptOut(user, institution || UZH);
		}
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
