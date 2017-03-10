'use strict';

const express = require('express');
const path = require('path');

// Constants
const PORT = 8088;

// App
const app = express();
app.get('/api/now_playing', function (req, res) {
    res.json({
        "title":    "joylent-arvosteluilta",
        "by":       "dominakääpiö",
        "start":    "00:00:00 01-01-1970",
        "end":      "01:00:00 01-01-1970"
    });
});

app.get('/api/programmes', function (req, res) {
    res.json([{
        "title":    "joylent-arvosteluilta 1",
        "by":       "dominakääpiö",
        "start":    "00:00:00 01-01-1970",
        "end":      "01:00:00 01-01-1970"
    }, 
    {
        "title":    "joylent-arvosteluilta 2",
        "by":       "dominakääpiö",
        "start":    "01:00:00 01-01-1970",
        "end":      "02:00:00 01-01-1970"
    }]);
});

app.get('/mediakortti', function(req, res) {
    res.redirect('/mainostajille.html');
});

// Static directories
app.use('/static', express.static('static'));
app.use(express.static('templates'));

// Listen on port 8088
app.listen(PORT, "0.0.0.0");
console.log('Running on http://localhost:' + PORT);
