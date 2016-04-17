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
        var options = this.options
            serverClock = this;

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
          var i, lot,
            htmlRowFirstColumn = '',
            htmlColTime = '';

          if (!data) {
            return;
          }

          i = data.length;

          while (i > -1) {

            lot = data[i];

            htmlRowFirstColumn = serverClock.getHTMLRowFirstColumn(
                lot.lotId,
                this._isTimeOver(lot.endTime) ? 'active' : 'passive')
              + htmlRowFirstColumn;

            htmlColTime = serverClock.getHTMLRowTimeColumn(lot.endTime)
            + htmlColTime;

            i = i - 1;
          }

          document.getElementById('time-column').innerHTML = htmlRowFirstColumn;
          document.getElementById('time-column').innerHTML = htmlColTime;

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
        }
    },

    getHTMLRowFirstColumn: function (lotId, text) {
      return [
        '<div class="row-lot-', lot.lotId,
        ' d-v-td"><i id="lot-status-', lot.lotId,
        '" class="icon s-mr_5 tooltip">',
        '<div class="tolWrapp"><div class="tolbody">',
        text,
        '</div></div></i>'
      ].join('');
    },

    getHTMLRowTimeColumn: function (remainingTime) {
      return ['<div class="d-v-td">',
        getClockString(
          remainingTime.Hours,
          remainingTime.Minutes,
          remainingTime.Seconds
        ),
        '</div>'].join('');
    }

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
