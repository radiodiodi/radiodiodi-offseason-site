'use strict';

const express = require('express');
const path = require('path');
const rp = require('request-promise');
const fs = require('fs')
const _ = require('lodash');

// Constants
const PORT = 8088;
const HOST = "0.0.0.0";
const ROOT_PATH = "http://" + HOST + ":" + PORT;

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
    res.render('mediakortti');
});

app.get('/en/advertisers', function(req, res) {
    res.render('en_mediakortti');
});

app.get('/en/', function(req, res) {
    res.render('en_index');
});

app.get('/', (req, res) => {
    const today = 15;
    rp({ uri: ROOT_PATH + '/api/programmes', json: true })
        .then(r => {
            r = r.sort((x, y) => + Date.parse(x.start) - Date.parse(y.start));
            return res.render('index', {
                programmes: {
                today: 15,
                all: _.groupBy(r, (x) => x.start.substr(8, 2))
              }
            });
        });
});

// Static directories
app.use('/static', express.static('static'));

// Listen on port 8088
app.listen(PORT, "0.0.0.0");
console.log('Running on ' + ROOT_PATH);
