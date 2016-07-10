var express = require('express');
var app = express();
var server = require('../lib/server');

app.get('/', server.router);

app.listen(2000);
