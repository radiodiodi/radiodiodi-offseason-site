'use strict';

const express = require('express');
const path = require('path');
const rp = require('request-promise');
const fs = require('fs')
const _ = require('lodash');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const readline = require('readline');
const http = require('http');
const mongodb = require('mongodb');
const MongoClient = require('mongodb').MongoClient
var db

// Constants
const PORT = 8088;
const HOST = "0.0.0.0";
const ROOT_PATH = "http://" + HOST + ":" + PORT;
const CALENDAR_ID = "radiodiodi.fi_9hnpbn3u6ov84uv003kaghg4rc@group.calendar.google.com";
const MONGODB_URL = "mongodb://localhost:27017/radiodiodi_listener_stats";

// Calendar constants
const START_DATE = new Date(Date.parse("2017-04-12T00:00:00.000+03:00"));
const END_DATE = new Date(Date.parse("2017-05-01T00:00:00.000+03:00"));
const API_INTERVAL = 1000 * 60 * 60; // 1 hour
const LIBRARY_INTERVAL = 1000 * 60 * 60; // 1 hour
const ICECAST_INTERVAL = 1000 * 60; // 1 minute

// App
const app = express();
app.set('view engine', 'ejs');

function log(string) {
    console.log(new Date + ": " + string);
}

process.on('uncaughtException', function (err) {
    log(err);
}); 

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/radiodiodi-calendar-credentials.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
        process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'radiodiodi-calendar-credentials.json';

var calendar_data = [];
// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
        log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Calendar API.
    function listEventsPeriodic() {
        authorize(JSON.parse(content), listEvents);
    }

    listEventsPeriodic();
    setInterval(listEventsPeriodic, API_INTERVAL);
        
});

var musicLibrary = [];

function readLibraryPeriodic() {
    fs.readFile('library.json', function readLibraryFile(err, content) {
        if (err) {
            log('Error loading library json file: ' + err);
            return;
        }

        try {
            musicLibrary = JSON.parse(content);
            log('Read ' + musicLibrary.length + " tracks from music database.");
        } catch (err) {
            log(err);
        }
    });
}

readLibraryPeriodic();
setInterval(readLibraryPeriodic, LIBRARY_INTERVAL);

function readIcecastStatsPeriodic() {
    var opts = {
        host: 'virta.radiodiodi.fi',
        path: '/status-json.xsl',
        method: 'GET'
    };

    var callback = function(response) {
        var str = ''
        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('error', function (err) {
            log(err);
        });

        function addStats(source) {
            var name = source.listenurl;

            // Manually fix timezone problem with plotly.js
            // https://community.plot.ly/t/timezone-on-plotlyjs/26
            const TZ_HOURS = 3;
            var date = new Date;
            date.setHours(date.getHours() + TZ_HOURS);

            var value = {
                'listeners': source.listeners,
                'time': date,
                'name': name
            }

            db.collection('listeners').save(value, (err, result) => {
                if (err) {
                    log(err);
                    return;
                }
            });
        }

        response.on('end', function () {
            // because icecast produces broken json
            var fixed = str.replace(/1\./g, '1');

            var obj = JSON.parse(fixed);
            var source = obj.icestats.source;
            if (source.constructor === Array) {
                source.forEach((s) => addStats(s));
            } else {
                addStats(source);
            }

        });
    }

    try {
        var req = http.request(opts, callback);
        req.end();
    } catch (err) {
        log(err);
    }
}

readIcecastStatsPeriodic();
setInterval(readIcecastStatsPeriodic, ICECAST_INTERVAL);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function(err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
    var calendar = google.calendar('v3');
    calendar.events.list({
        auth: auth,
        calendarId: CALENDAR_ID,
        timeMin: START_DATE.toISOString(),
        timeMax: END_DATE.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
    }, function(err, response) {
        if (err) {
            log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length == 0) {
            log('No upcoming events found.');
        } else {
            log('Received ' + events.length + ' events from Google Calendar.');
            var new_calendar = [];
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var title = event.summary;
                var by = event.description || "";
                var start = event.start.dateTime || event.start.date;
                var end = event.end.dateTime || event.end.date;
                var result = {'title': title, 'by': by,
                    'start': start, 'end': end
                };
                new_calendar.push(result);
            }
            calendar_data = new_calendar;
        }
    });
}


app.get('/api/now_playing', function (req, res) {
    res.json(calendar_data.filter(d => {
        return Date.parse(d['start']) < new Date
    }).pop());
});

app.get('/api/programmes', function (req, res) {
    res.json(calendar_data);
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
    rp({ uri: ROOT_PATH + '/api/programmes', json: true })
        .then(r => {
            r = r.sort((x, y) => + Date.parse(x.start) - Date.parse(y.start));
            var grouped = _.groupBy(r, (x) => x.start.substr(8, 2));
            return res.render('index', {
                programmes: {
                    today: (new Date).getDate(),
                    weekdays: ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai'],
                    all: grouped
                }
            });
        });
});

app.get('/shoutbox', function(req, res) {
    res.render('shoutbox');
});

app.get('/calendar', function(req, res) {
    res.render('calendar');
});

app.get('/library', function(req, res) {
    if (req.query.search) {
        var queryTitle = req.query.title == 'on';
        var queryArtist = req.query.artist == 'on';
        var queryAlbum = req.query.album == 'on';
        var querySearch = req.query.search.toLowerCase().trim().replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '');

        var filtered = [];
        _.forEach(musicLibrary, function (o) {
            if (queryTitle && _.includes(o['title'].toLowerCase().replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ''), querySearch)) {
                filtered.push(o);
            }
            if (queryArtist && _.includes(o['artist'].toLowerCase().replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ''), querySearch)) {
                filtered.push(o);
            }
            if (queryAlbum && _.includes(o['album'].toLowerCase().replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ''), querySearch)) {
                filtered.push(o);
            }
        });

        res.render('library', {
            data: filtered
        });
    } else {
        res.render('library', {
            data: null
        });
    }
});

app.get('/stream', function(req, res) {
    res.render('stream');
});

app.get('/virtuaalitodellisuus', function(req, res) {
    res.redirect(301, 'http://lib.aalto.fi/fi/current/news/2017-03-20-002/');
});

app.get('/stats', function(req, res) {
    var options = {
        'sort': [['time','desc']] 
    };

    db.collection('listeners').find({}, options).toArray(function(err, results) {
        if (err) {
            log(err);
            return;
        }
        
        var arr = [];
        var mountpoints = _.groupBy(results, (r) => r.name);

        Object.keys(mountpoints).forEach((m) => {
            var obj = {
                'x': mountpoints[m].map((r) => r.time),
                'y': mountpoints[m].map((r) => r.listeners),
                'type': 'scatter',
                'line': {'shape': 'spline'},
                'name': m
            };
            arr.push(obj);
        });

        res.render('stats', {
            'data': JSON.stringify(arr),
            'current': _.sumBy(arr, function(o) { return o['y'][0] })
        }); 
    });
});

// Static directories
app.use('/static', express.static('static'));


MongoClient.connect(MONGODB_URL, (err, database) => {
    if (err)
        return log(err)

    log('Connected to MongoDB at ' + MONGODB_URL);
    db = database
    // Listen on port 8088
    app.listen(PORT, "0.0.0.0");
    log('Running on ' + ROOT_PATH);
});
