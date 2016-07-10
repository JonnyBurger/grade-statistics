import express from 'express';
import test from 'ava';
import fetch from 'node-fetch';
import server from '../lib/server';

var app = express();

app.get('/', server.router);

app.listen(2000);

test('Server does respond', async t => {
	let response = await fetch('http://localhost:2000').then(response => response.text());
	t.is(response, 'ha');
});
