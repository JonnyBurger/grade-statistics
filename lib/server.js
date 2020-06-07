'use strict';

const express = require('express');
const co = require('co');
const bodyParser = require('body-parser');
const db = require('./db');
const handleRepeatedExams = require('./handle-repeat-exams');

exports.router = new express.Router();
exports.router.use(bodyParser.json());

const UZH = 'UZH';

exports.router.post('/', (request, response) => {
	return co(function * () {
		const payload = request.body;
		payload.grades = handleRepeatedExams(payload.grades);
		yield db.deleteUser(request.body.user, request.body.institution || UZH);
		yield db.insertStats(
			payload.grades.map(g => [
				request.body.user,
				g.module,
				g.grade,
				g.semester,
				g.repeated,
				request.body.institution || UZH
			])
		);
		successHandler(response);
	}).catch(error => errorHandler(response, error));
});

exports.router.get('/:institution(ETH|UZH)/:module', (request, response) => {
	return co(function * () {
		const stats = yield db.getAllStats(
			request.params.module,
			request.params.institution
		);
		successHandler(response, stats);
	}).catch(error => errorHandler(response, error));
});

exports.router.get('/:module', (request, response) => {
	return co(function * () {
		const stats = yield db.getAllStats(request.params.module, UZH);
		successHandler(response, stats);
	}).catch(error => errorHandler(response, error));
});

exports.router.post('/opted-in', (request, response) => {
	return co(function * () {
		const optedIn = yield db.studentIsOptedIn(
			request.body.user,
			request.body.institution || UZH
		);

		successHandler(response, {
			optedIn
		});
	}).catch(error => errorHandler(response, error));
});

exports.router.delete('/', (request, response) => {
	return co(function * () {
		const {user, institution} = request.body;
		const optedIn = yield db.studentIsOptedIn(user, institution || UZH);
		if (optedIn) {
			yield db.deleteUser(user, institution || UZH);
		}

		successHandler(response);
	}).catch(error => errorHandler(response, error));
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
