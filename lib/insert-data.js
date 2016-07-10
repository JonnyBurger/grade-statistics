#!/usr/bin/node

var path = require('path');
var fs = require('fs');
var co = require('co');
var junk = require('junk');
var db = require('./db');

co(function * () {
	var files = fs.readdirSync(path.join(__dirname, '..', 'data')).filter(junk.not);

	for (var i = 0; i < files.length; i++) {
		var fileContent = require(path.join(__dirname, '..', 'data', files[i]));
		try {
			yield db.insertPredefined(fileContent);
			console.log(`inserted ${files[i]}`);
		} catch (err) {
			if (err.code === '23505') {
				console.log(`${files[i]} was already inserted`);
			} else {
				throw err;
			}
		}
	}
})
.then(() => process.exit(0))
.catch(err => {
	console.error(err);
	process.exit(1);
});
