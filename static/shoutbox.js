var prefix = 'https://';
var api_url = prefix + window.location.host + ':5000/api/messages';
var url = 'wss://' + window.location.host + ':5000/ws',
sock,
    box = document.getElementById('box'),
    text = document.getElementById('text'),
    uname = document.getElementById('name'),
    MIN_INTERVAL = 1000,
    last_post = 0;

try {
    sock = new WebSocket(url);
} catch (e) {
    box.innerHTML = 'Your browser doesn\'t support WebSockets. Try upgrading to a more recent browser';
}

var xhr = new XMLHttpRequest();
xhr.open('GET', api_url);
xhr.onload = function() {
    if (xhr.status === 200) {
        var content = JSON.parse(xhr.responseText);
        box.innerHTML += content.map(function(msg) {
                return formatTime(msg.timestamp) + ' ' + msg.user + ': ' + msg.text + '\n';
                }).reduce(function (a, b) { return a + '\n' + b; }, '');
    } else {
        box.innerHTML = 'Failed to load messages from server';
    }
};
xhr.send();

function formatTime (time) {
    return new Date(time).toString().split(' ')[4];
};

sock.onmessage = function (msg) {
    var data = JSON.parse(msg.data);
    var line =  formatTime(data.timestamp) + ' ' + data.user + ' ' + data.text;
    box.innerText += '\n' + line + '\n';
    box.scrollTop = box.scrollHeight;
};

function send (e) {
    var interval = Date.now() - last_post;
    if ((e.keyCode === 13 || e.type !== 'keydown') && text.value !== '' && interval > MIN_INTERVAL) {
        if (sock.readyState === sock.OPEN) {
            uname.value = uname.value || 'Vieras' + Math.floor(Math.random() * 1000);
            sock.send(JSON.stringify({
                user:      uname.value,
                text:      text.value,
                timestamp: (new Date).toISOString()
            }));
        } else {
            console.log('WebSocket not open');
        }
        text.value = '';
        last_post = Date.now();
    }
}
uname.onkeydown = send;
text.onkeydown = send;
document.getElementById('send').onclick = send;
box.scrollTop = box.scrollHeight;
