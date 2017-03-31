'use strict';

const express = require('express');
const path = require('path');
const rp = require('request-promise');
const fs = require('fs')

// Constants
const PORT = 8088;
const HOST = 'http://localhost:' + PORT;

// App
const app = express();

app.set('view engine', 'ejs');
var dummy_data = {}
fs.readFile('dummy.json', 'utf8', function (err,data) {
    if (err) {
        return console.log(err);
    }
    dummy_data = JSON.parse(data);
});

app.get('/api/now_playing', function (req, res) {
    res.json(dummy_data[0]);
});

app.get('/api/programmes', function (req, res) {
    res.json(dummy_data);
});

app.get('/mediakortti', function(req, res) {
    res.redirect('/mainostajille.html');
});

app.get('/', (req, res) => {
    rp({ uri: HOST + '/api/programmes', json: true })
      .then(r => res.render('index', {programmes: r}))
})

// Static directories
app.use('/static', express.static('static'));
app.use(express.static('templates'));

// Listen on port 8088
app.listen(PORT, "0.0.0.0");
console.log('Running on http://localhost:' + PORT);
