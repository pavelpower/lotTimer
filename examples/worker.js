var timer = null;
var DATA = (function () {
    var data = [], i = 10000,
        startDate = new Date();

    for (; i >= 0; i--) {
        data.push(startDate);
    }

    return data;
})();


function resolve (startTime) {
    var i = DATA.length - 1;
    var now =  Date.now();
    var diffSec = Math.floor((now - startTime) / 1000);

    for (; i >=0; i--) {
        DATA[i] = addSecondsForTime(DATA[i], diffSec);
    }

    sendHTML.call(this, render(DATA));
}

function addSecondsForTime (date, diffSec) {
    date.setSeconds(date.getSeconds() - diffSec);
    return date;
}

function render (data) {
    var html = '',
        i = data.length - 1;

    for (; i >= 0; i--) {

        html += this.applyTemplate(data[i]);
    }

    return html;
}

function applyTemplate(data) {
    return [
        '<div>',
        data.getHours(), ':',
        data.getMinutes(), ':',
        data.getSeconds(),
        '</div>'
    ].join('');
}

function sendHTML (HTML) {
    this.postMessage({html: HTML});
}

function runTimer () {
    var startTime = Date.now(),
        tick;

    tick = function () {
        resolve.call(this, startTime);

        timer = setTimeout(tick, 1000);
    }.bind(this);

    tick();
}

function stopTimer () {
    clearTimeout(timer);
}

addEventListener('message', function(e) {
    var data = e.data;
    switch (data.cmd) {
        case 'start':
            runTimer.call(this);
            break;
        case 'stop':
            stopTimer.call(this);
            break;
        default:
            this.postMessage({error: 'Unknown command: ' + data.msg});
    }
}, false);