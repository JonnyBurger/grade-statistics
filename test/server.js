import express from 'express';
import md5 from 'md5';
import test from 'ava';
import fetch from 'node-fetch';
import server from '../lib/server';
import db from '../lib/db';

test.beforeEach(async () => {
	await db.reset();
	await db.createTables();
});

var app = express();
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

test('Should allow insertion of modules', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		]
	};
	let postResponse = await doInsert(payload);
	var postStatus = postResponse.status;
	var postJson = await postResponse.json();
	t.deepEqual(postJson, {
		success: true
	});
	t.is(postStatus, 200);

	let getResponse = await fetch(`http://localhost:2000/50030855`);
	var getJson = await getResponse.json();
	t.is(getResponse.status, 200);
	t.is(getJson.total.passed, 1);
	t.is(getJson.total.failed, 0);
	t.is(getJson.total.average, 4);
	t.is(getJson.detailed.length, 1);
	t.is(getJson.success, true);
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
		]
	};

	let postResponse = await doInsert(payload);

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
		]
	};

	let postResponse = await doInsert(badPayload);
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
		]
	};

	let postResponse = await doInsert(badPayload);
	t.is(postResponse.status, 400);
});

test('Should reject payload without module', async t => {
	const badPayload = {
		user: md5('joburg'),
		grades: [
			{
				semester: 'FS14',
				grade: 5
			}
		]
	};

	let postResponse = await doInsert(badPayload);
	t.is(postResponse.status, 400);
});

test('Should reject empty payload', async t => {
	const badPayload = {};

	let postResponse = await doInsert(badPayload);
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
		]
	};

	let postResponse = await doInsert(payload);
	t.is(postResponse.status, 400);
});

test('Should not be able to overwrite semester', async t => {
	const firstPayload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		]
	};

	let firstResponse = await doInsert(firstPayload);
	t.is(firstResponse.status, 200);

	const secondPayload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 5
			}
		]
	};

	let secondResponse = await doInsert(secondPayload);
	t.is(secondResponse.status, 400);

	let getResponse = await fetch('http://localhost:2000/50030855');
	let getJson = await getResponse.json();
	t.is(getJson.total.average, 4);
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
		]
	};
	let firstResponse = await doInsert(firstPayload);
	t.is(firstResponse.status, 200);

	let secondPayload = {
		user: md5('joburg')
	};
	let secondResponse = await fetch('http://localhost:2000', {
		method: 'DELETE',
		body: JSON.stringify(secondPayload),
		headers: {
			'Content-Type': 'application/json'
		}
	});
	t.is(secondResponse.status, 200);

	let thirdResponse = await fetch('http://localhost:2000/50030855');
	let getJson = await thirdResponse.json();
	t.is(getJson.total.passed, 0);
	t.is(getJson.detailed.length, 0);
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
		]
	};
	let response = await doInsert(payload);
	let json = await response.json();
	t.is(response.status, 400);
	t.regex(json.error, /md5/i);
});

test('Should tell me when I am opted in', async t => {
	const payload = {
		user: md5('joburg'),
		grades: [
			{
				module: 50030855,
				semester: 'FS15',
				grade: 4
			}
		]
	};
	await doInsert(payload);

	let response = await fetch('http://localhost:2000/opted-in', {
		method: 'POST',
		body: JSON.stringify({
			user: md5('joburg')
		}),
		headers: {
			'Content-Type': 'application/json'
		}
	});
	let json = await response.json();
	t.is(json.optedIn, true);
});

test('Should handle Wiederholungsprüfungen', async t => {
	const payload = {
		user: 'da17d6edea42bf74fcd26015a9975030',
		grades: [
			{semester: 'HS15', module: '50335165', grade: 4.5},
			{semester: 'HS15', module: '50332398', grade: 4},
			{semester: 'HS15', module: '50335165', grade: 3}
		]
	};

	let response = await doInsert(payload);
	t.is(response.status, 200);
});
