'use strict';

const express = require('express');
const path = require('path');
const rp = require('request-promise');
const fs = require('fs')
const _ = require('lodash');
const google = require('googleapis');
const googleAuth = require('google-auth-library');
const readline = require('readline');

// Constants
const PORT = 8088;
const HOST = "0.0.0.0";
const ROOT_PATH = "http://" + HOST + ":" + PORT;
const CALENDAR_ID = "radiodiodi.fi_9hnpbn3u6ov84uv003kaghg4rc@group.calendar.google.com"

// Calendar constants
const START_DATE = new Date(Date.parse("2017-04-12T00:00:00.000+03:00"));
const END_DATE = new Date(Date.parse("2017-05-01T00:00:00.000+03:00"));
const API_INTERVAL = 1000 * 60 * 60; // 1 hour
const LIBRARY_INTERVAL = 1000 * 60 * 60; // 1 hour

// App
const app = express();

app.set('view engine', 'ejs');
var calendar_data = [];

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/radiodiodi-calendar-credentials.json
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
        process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'radiodiodi-calendar-credentials.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
    if (err) {
        console.log('Error loading client secret file: ' + err);
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
            console.log('Error loading library json file: ' + err);
            return;
        }

        try {
            musicLibrary = JSON.parse(content);
            console.log("Read library: " + musicLibrary.length + " items.");
        } catch (err) {
            console.log(err);
        }
    });
}

readLibraryPeriodic();
setInterval(readLibraryPeriodic, LIBRARY_INTERVAL);

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
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length == 0) {
            console.log('No upcoming events found.');
        } else {
            console.log('Received ' + events.length + ' events.');
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
    res.json(calendar_data[0]);
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
                    today: 18,
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
        var querySearch = req.query.search.toLowerCase().trim();

        var filtered = [];
        _.forEach(musicLibrary, function (o) {
            if (queryTitle && _.includes(o['title'].toLowerCase(), querySearch)) {
                filtered.push(o);
            }
            if (queryArtist && _.includes(o['artist'].toLowerCase(), querySearch)) {
                filtered.push(o);
            }
            if (queryAlbum && _.includes(o['album'].toLowerCase(), querySearch)) {
                filtered.push(o);
            }
        });

        res.render('library', {
            data: filtered
        });
    } else {
        res.render('library', {
            data: []
        });
    }
});

// Static directories
app.use('/static', express.static('static'));

// Listen on port 8088
app.listen(PORT, "0.0.0.0");
console.log('Running on ' + ROOT_PATH);
