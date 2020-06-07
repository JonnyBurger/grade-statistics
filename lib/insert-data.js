#!/usr/bin/node

const path = require('path');
const fs = require('fs');
const co = require('co');
const junk = require('junk');
const db = require('./db');

co(function * () {
	const files = fs
		.readdirSync(path.join(__dirname, '..', 'data'))
		.filter(f => junk.not(f));

	for (const file of files) {
		const fileContent = require(path.join(__dirname, '..', 'data', file));
		try {
			yield db.insertPredefined(fileContent);
			console.log(`inserted ${file}`);
		} catch (error) {
			if (error.code === '23505') {
				console.log(`${file} was already inserted`);
			} else {
				throw error;
			}
		}
	}
})
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
