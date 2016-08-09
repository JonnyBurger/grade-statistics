#!/usr/bin/node

var co = require('co');
var db = require('./db');

co(function * () {
	// yield db.reset();
	yield db.createTables();
})
.then(() => process.exit(0))
.catch(err => {
	console.error(err);
	process.exit(1);
});
