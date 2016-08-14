'use strict';

var express = require('express');
var co = require('co');
var bodyParser = require('body-parser');
var db = require('./db');
var handleRepeatedExams = require('./handle-repeat-exams');
var {MAX_OPTOUTS} = require('./config');

exports.router = new express.Router();
exports.router.use(bodyParser.json());

exports.router.post('/', function (request, response) {
	return co(function *() {
		const payload = request.body;
		payload.grades = handleRepeatedExams(payload.grades);
		for (var i = 0; i < payload.grades.length; i++) {
			var {module, grade, semester, repeated} = payload.grades[i];
			try {
				yield db.insertStat(request.body.user, module, grade, semester, repeated);
			} catch (e) {
				// Ignore duplicate inserts that ignore unique constraint
				// Ignore stats without a grade that can get sent
				if (e.code !== '23505' && e.code !== '23502') {
					throw e;
				}
			}
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
		var optOuts = yield db.studentOptOutCount(request.body.user);

		successHandler(response, {
			optedIn,
			optOuts,
			maxOptOuts: MAX_OPTOUTS
		});
	})
	.catch(err => errorHandler(response, err));
});

exports.router.delete('/', function (request, response) {
	return co(function *() {
		const {user} = request.body;
		let optedIn = yield db.studentIsOptedIn(user);
		if (optedIn) {
			const optOuts = yield db.studentOptOutCount(user);
			if (optOuts >= MAX_OPTOUTS) {
				throw new Error('Maximale Anzahl an Opt-Outs erreicht.');
			}
			yield db.deleteUser(user);
			yield db.addOptOut(user);
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
