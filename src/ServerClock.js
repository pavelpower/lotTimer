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
        remainingTimeSelector: '#auction-end-clock, .auction-end-clock ',
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

        this.lotTimer.signalLotsUpdated = function (data) {
          var lot; 
        };

        this.lotTimer.signalRemainingTimeUpdate = function (remainingTime, dataLots) {
            var len, i = 0, lotRemainderTime, lot;
            var timeText = getClockString(
                remainingTime.Hours,
                remainingTime.Minutes,
                remainingTime.Seconds
            );

            $(options.remainingTimeSelector)
                .text(timeText);

            if (dataLots) {

                len = dataLots.length;

                for (; i < len; i++) {

                    lot = dataLots[i];

                    $el = document.getElementById(options.remainingTimeLotSelector + lot.lotId);

                    if ($el == null) {
                       continue;
                    }

                    if (this._isTimeOver()) {
                        // время вышло
                        span = ['<span class="time-is-over">', lot.endTime, '</span>'].join('');
                    } else {
                        span = ['<span class="time-is-live">', timeText, '</span>'].join('');
                    }

                    $el.innerHTML = span;
                }
            }
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
