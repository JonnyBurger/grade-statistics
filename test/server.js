import express from 'express';
import server from '../lib/server';
var app = express();

app.get('/', server.router);

app.listen(2000);
