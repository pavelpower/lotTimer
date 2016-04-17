/**
 * Кнотроллер Виджета серверного времени
 * @constructor
 */
function ServerClock(options) {

    this.defaults = {
        mode: 'member',
        syncUrl: window.realEndTimeSyncUrl + '/' + window.auctionId,
        syncLotsUrl: window.realLotEndTimeSyncUrl + '/' + window.auctionId,
        durationMode: window.durationMode ? window.durationMode : 'none',
        syncInterval: 60000,
        processLotsSelector: '#lots-table tr[id]:not(.lot-disable)',
        serverTimeSelector: '#server-clock',
        remainingTimeId: 'auction-end-clock',
        //remainingTimeLotSelector: '#lot-end-clock-',
        remainingTimeLotSelector: 'lot-end-clock-',
        lotStatusSelector: '#lot-status-',
        lotStatusActiveText: 'Аукцион по позиции продолжается',
        lotStatusStopText: 'Аукцион по позиции завершен'
    };

    options = options || {};
    this.options = $.extend(this.defaults, options);
}

ServerClock.prototype = {

    init: function () {
        var options = this.options;

        if (this.options.mode == 'org') {
            $('#bootstrap_alert').appendAlert(this.options.message + '<span class="auction-end-clock"></span>)', 'warning');
        }

        this.$serverTimeElement = $(this.options.serverTimeSelector);
        this.$remainingTimeElement = $(this.options.remainingTimeSelector);

        this.lotTimer = new LotTimer(this.options);

        this.lotTimer.signalServerTimeUpdated = function (serverTime) {
            $(options.serverTimeSelector)
                .text(getClockString(serverTime.getHours(), serverTime.getMinutes(), serverTime.getSeconds()));
        };

        this.lotTimer.signalLotsUpdated = function ($htmlRow) {
          document.getElementById('first-column').innerHTML = $htmlRow.firstColumn;
          document.getElementById('time-column').innerHTML = $htmlRow.timeColumn;
        };

        this.lotTimer.signalRemainingTimeUpdate = function (remainingTime) {
            var timeText = getClockString(
                remainingTime.Hours,
                remainingTime.Minutes,
                remainingTime.Seconds
            );

            document.getElementById(options.remainingTimeId).innerText = timeText;
        }
    },

    getServerTime: function () {
        this.lotTimer.syncServerTime();
    }
};


function addZero(value) {
    if (value >= 0 && value <= 9) return '0' + value;
    return value;
}
function getSmallClockString(h, m) {
    return addZero(h) + ':' + addZero(m);
}
function getClockString(h, m, s) {
    return getSmallClockString(h, m) + ':' + addZero(s);
}
