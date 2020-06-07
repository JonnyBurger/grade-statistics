const express = require('express');
const md5 = require('md5');
const test = require('ava');
const fetch = require('node-fetch');
const server = require('../lib/server');
const db = require('../lib/db');
const {MAX_OPTOUTS} = require('../lib/config');

test.beforeEach(async () => {
	await db.reset();
	await db.createTables();
});

const app = express();
app.use('/', server.router);
app.listen(2000);

function doInsert(payload) {
	return fetch('http://localhost:2000/', {
		method: 'POST',
		body: JSON.stringify(payload),
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

function doDelete(user) {
	return fetch('http://localhost:2000', {
		method: 'DELETE',
		body: JSON.stringify({
			user: md5(user),
			institution: 'UZH'
		}),
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

function doOptedInRequest(user) {
	return fetch('http://localhost:2000/opted-in', {
		method: 'POST',
		body: JSON.stringify({
			user: md5(user),
			institution: 'UZH'
		}),
		headers: {
			'Content-Type': 'application/json'
		}
	});
}

test('Should allow insertion of modules', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};
	const postResponse = await doInsert(payload);
	const postStatus = postResponse.status;
	const postJson = await postResponse.json();
	t.deepEqual(postJson, {
		success: true
	});
	t.is(postStatus, 200);

	const getResponse = await fetch('http://localhost:2000/50030855');
	const getJson = await getResponse.json();
	t.is(getResponse.status, 200);
	t.is(getJson.total.passed, 1);
	t.is(getJson.total.failed, 0);
	t.is(getJson.total.average, 4);
	t.is(getJson.detailed.length, 1);
	t.is(getJson.success, true);
});

test('Should allow insertion of ETH modules', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'ETH'
	};
	const postResponse = await doInsert(payload);
	const postStatus = postResponse.status;
	const postJson = await postResponse.json();
	t.deepEqual(postJson, {
		success: true
	});
	t.is(postStatus, 200);

	const getResponse = await fetch('http://localhost:2000/ETH/50030855');
	const getJson = await getResponse.json();
	t.is(getResponse.status, 200);
	t.is(getJson.total.passed, 1);
	t.is(getJson.total.failed, 0);
	t.is(getJson.total.average, 4);
	t.is(getJson.detailed.length, 1);
	t.is(getJson.success, true);
	// No accidential UZH insertions
	const getResponse2 = await fetch('http://localhost:2000/50030855');
	const getJson2 = await getResponse2.json();
	t.is(getResponse2.status, 200);
	t.is(getJson2.total.passed, 0);
});

test('Should not allow insertion of grade bigger than 6', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030856,
				semester: 'FS14',
				grade: 7
			}
		],
		institution: 'UZH'
	};

	const postResponse = await doInsert(payload);

	t.is(postResponse.status, 400);
});

test('Should reject payload without username', async t => {
	const badPayload = {
		grades: [
			{
				module: 50030856,
				semester: 'FS14',
				grade: 5
			}
		],
		institution: 'UZH'
	};

	const postResponse = await doInsert(badPayload);
	t.is(postResponse.status, 400);
});

test('Should reject payload without semester', async t => {
	const badPayload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030856,
				grade: 5
			}
		],
		institution: 'UZH'
	};

	const postResponse = await doInsert(badPayload);
	t.is(postResponse.status, 400);
});

test('Should reject empty payload', async t => {
	const badPayload = {};

	const postResponse = await doInsert(badPayload);
	t.is(postResponse.status, 400);
});

test('Should reject invalid semester', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030856,
				semester: 'bestande',
				grade: 5
			}
		],
		institution: 'UZH'
	};

	const postResponse = await doInsert(payload);
	t.is(postResponse.status, 400);
});

test('Should be be able to overwrite semester', async t => {
	const firstPayload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};

	const firstResponse = await doInsert(firstPayload);
	t.is(firstResponse.status, 200);

	const secondPayload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 5
			}
		],
		institution: 'UZH'
	};

	await doInsert(secondPayload);

	const getResponse = await fetch('http://localhost:2000/50030855');
	const getJson = await getResponse.json();
	t.is(getJson.total.average, 5);
});

test('Should be able to delete own grades', async t => {
	const firstPayload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};
	const firstResponse = await doInsert(firstPayload);
	t.is(firstResponse.status, 200);

	const secondResponse = await doDelete('joburg');
	t.is(secondResponse.status, 200);

	const thirdResponse = await fetch('http://localhost:2000/50030855');
	const getJson = await thirdResponse.json();
	t.is(getJson.total.passed, 0);
	t.is(getJson.detailed.length, 0);
});

test('Should count opt-outs correctly', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};
	await doInsert(payload);
	await doDelete('joburg');

	await doInsert(payload);
	await doDelete('joburg');

	const response = await doOptedInRequest('joburg');
	const json = await response.json();
	t.is(json.optedIn, false);
	t.is(json.optOuts, 2);
});

test('Should not count opt-out if not opted in', async t => {
	await doDelete('joburg');
	const response = await doOptedInRequest('joburg');
	const json = await response.json();
	t.is(json.optOuts, 0);
});

test('Should not allow opt-out after max opt-outs', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};

	for (let i = 0; i < MAX_OPTOUTS; i++) {
		// eslint-disable-next-line no-await-in-loop
		await doInsert(payload);
		// eslint-disable-next-line no-await-in-loop
		await doDelete('joburg');
	}

	await doInsert(payload);
	const response = await doDelete('joburg');
	t.is(response.status, 400);
});

test('User should be a md5 hash', async t => {
	const payload = {
		user: 'joburg',
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};
	const response = await doInsert(payload);
	const json = await response.json();
	t.is(response.status, 400);
	t.regex(json.error, /md5/i);
});

test('Should tell me whether I am opted in', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		],
		institution: 'UZH'
	};
	await doInsert(payload);

	const response = await doOptedInRequest('joburg');
	const json = await response.json();
	t.is(json.optedIn, true);
});

test('Should handle Wiederholungsprüfungen', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{semester: 'HS15', module: '50335165', grade: 4.5},
			{semester: 'HS15', module: '50332398', grade: 4},
			{semester: 'HS15', module: '50335165', grade: 3}
		],
		institution: 'UZH'
	};

	const response = await doInsert(payload);
	t.is(response.status, 200);
});

test('Should allow to insert new grades', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [{semester: 'HS15', module: '50335165', grade: 4}],
		institution: 'UZH'
	};

	const response = await doInsert(payload);
	t.is(response.status, 200);

	const payload2 = {
		user: md5('joburg'),
		grades: [
			{semester: 'HS15', module: '50335165', grade: 4},
			{semester: 'FS16', module: '50332398', grade: 5}
		],
		institution: 'UZH'
	};

	const response2 = await doInsert(payload2);
	t.is(response2.status, 200);

	const module1 = await fetch('http://localhost:2000/50335165');
	const json1 = await module1.json();

	t.is(json1.total.count, 1);
	t.is(json1.total.average, 4);

	const module2 = await fetch('http://localhost:2000/50332398');
	const json2 = await module2.json();

	t.is(json2.total.count, 1);
	t.is(json2.total.average, 5);
});

test('Should reject hash of empty string', async t => {
	const payload = {
		user: md5(''),
		grades: [{semester: 'HS15', module: '50332398', grade: 4}],
		institution: 'UZH'
	};

	const response = await doInsert(payload);
	t.is(response.status, 400);
});

test('Should reject hash of demo account', async t => {
	const payload = {
		user: md5('bestande'),
		grades: [{semester: 'HS15', module: '50332398', grade: 4}],
		institution: 'UZH'
	};

	const response = await doInsert(payload);
	t.is(response.status, 400);

	const json = await response.json();
	t.regex(json.error, /demo/i);
});
