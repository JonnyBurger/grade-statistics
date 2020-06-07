#!/usr/bin/node

const co = require('co');
const db = require('./db');

co(function * () {
	// Yield db.reset();
	yield db.createTables();
	yield db.createIndices();
})
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
