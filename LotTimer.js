/**
 * Класс вычислений оставшегося времени для лотов
 * Время синхронезируется с сервером
 * @constructor
 * @dependencies {jQuery}
 * @param options {Object} - настройки
 * @param options.syncUrl {String} - URL для обновления серверного времени
 * @param options.syncLotsUrl {String} - URL для обновления данных лотов
 * @param options.durationMode {String} - настройка в значении 'ProlongationByLots' не дает загружать данне лотов
 */
function LotTimer(options) {

    this._syncUrl = options.syncUrl;
    this._syncLotsUrl = options.syncLotsUrl;
    this._durationMode = options.durationMode;
    this._intervalTimeOfSyncServerTime = options.syncInterval;
    this._intervalTimeOfUpdateLotsRemaindersTimers = 1000;


    this.syncServerTime();
    this.startRecursiveSyncServerTime();
    this.startTimerUpdateLotsRemaindersTime();
}

LotTimer.prototype = {

    /**
     * URL для синхронизации серверного времени
     */
    _syncUrl: '',

    /**
     * Серверное время
     * @type {timestamp}
     */
    _serverTime: null,

    /**
     * Остаток времени
     * Обновляеться с сервера переодически - корректируеться
     * А так же обновляется при выислении по таймеру
     * @type {timestamp}
     */
    _remainderTime: null,

    /**
     * Если параметр выставлен в "ProlongationByLots" - проиходит обновление лотов
     */
    _durationMode: null,

    /**
     * Идентификатор таймера синхронизации данных серверного времени
     */
    __timerServerTime: null,

    /**
     * Таймер обновления времени всех лотов
     */
    __timerOfUpdateLotsRemainderTime: null,

    /**
     * Хэш хранения данных о лотах в формате: {lotId: lotRemainderTime};
     */
    dataOfLots: {},

    /**
     * Возаращает URL со случайным параметром, чтобы не кешировать
     * ответ от сервера, даже если он не поддерживает ETag
     * @param url {String} - URL запроса
     * @private
     */
    _getURLWithCMD: function (url) {
        return url + '?' + Date.now();
    },

    /**
     * Запустить переодическое обновление серверного времени
     */
    startRecursiveSyncServerTime: function () {
        this.__timerServerTime = setTimeout(function () {
                this.syncServerTime();
                this.startRecursiveSyncServerTime();
            }.bind(this),
            this._intervalTimeOfSyncServerTime
        );
    },

    /**
     * Остановить переодическое побновление серверного времени
     */
    stopRecursiveSyncServerTime: function () {
        clearTimeout(this.__timerServerTime);
    },

    /**
     * Синхронезация времени с сервером
     */
    syncServerTime: function () {
        var startSyncTime = this.getPresentTime();

        $.get(this._getURLWithCMD(this._syncUrl))
            .done(this._parseResponseServerTime.bind(this, startSyncTime))
            .fail(this.signalServerResponseFail.bind(this));
    },

    _parseResponseServerTime: function (startSyncTime, response) {
        var timeSpentOnRequest;

        if ($.type(response) !== 'object' || !response.endTimeSpan) {
            this.signalServerResponseFail();
            return;
        }

        // вычисляеться время потраченное на отправление и полуение запроса от сервера
        // делиться на два - это интересно почему, видимо из практики вычитано
        timeSpentOnRequest = Math.floor((this.getPresentTime() - startSyncTime) / 2);

        this.__lastTimestampServerTimeLoad = this.getPresentTime();

        // Вычисляеться количество прошедщих секунд по вычелсенному времени потраченному на запрос
        // и добавляеться к серверному времени
        this._remainderTime = this.addSecondsTo(response.endTimeSpan, Math.round(timeSpentOnRequest / 1000));

        if (this._isTimeOver()) {
            this.signalTimeIsOver();
            return;
        }

        this.setServerTime(response.dateTime, timeSpentOnRequest);

    },

    /**
     * Сохранить серверное время
     * @param dataTime {Date}
     * @param timeSpentOnRequest {timestamp}
     */
    setServerTime: function (dataTime, timeSpentOnRequest) {

        if (dataTime) {
            this._serverTime = new Date(
                dataTime.Year,
                dataTime.Month - 1,
                dataTime.Day,
                dataTime.Hour,
                dataTime.Minute,
                dataTime.Second,
                dataTime.Millisecond + timeSpentOnRequest
            );

            this.signalServerTimeUpdated(this._serverTime);
        }

        if (this._durationMode === 'ProlongationByLots') {
            this.getLotsData();
        }
    },

    /**
     * Получение данных лотов
     */
    getLotsData: function () {
        $.get(this._getURLWithCMD(this._syncLotsUrl), function (response) {

            if (response && response.lotsEndTime) {
                this.__lastTimestampLoadDataLots = this.getPresentTime();
                this.resolveLotsTime(response.lotsEndTime);
            }

            this.stopTimerUpdateLotsRemaindersTime();
            this.startTimerUpdateLotsRemaindersTime();

        }.bind(this));
    },

    /**
     * Обновление данных времени лотов
     * @param data
     */
    resolveLotsTime: function (data) {
        var i = 0,
            len = data.length,
            lot, lotRemainderTime;

        for (; i < len; i++) {
            lot = data[i];
            lotRemainderTime = lot.endTime;

            this.setLotReminderTime(lot.lotId, lotRemainderTime);
        }
    },

    /**
     * Сохранить оставшееся время в хэш лотов
     * Так же вызывает сигналы об обновлении лота
     * @param lotId {Number|String} - идентификатор лота
     * @param lotRemainderTime - остаток времени
     */
    setLotReminderTime: function (lotId, lotRemainderTime) {

        this.dataOfLots[lotId] = lotRemainderTime;

        if (this._isTimeOver(lotRemainderTime)) {
            this.signalLotIsClose(lotId, lotRemainderTime);
        } else {
            this.signalLotIsOpen(lotId, lotRemainderTime);
        }

        this.signalLotUpdate(lotId, lotRemainderTime);
    },

    /**
     * Обновление времени для всех лотов в хеше
     * путем вычисления времени прошедшего с момента последнего обноавления с сервера,
     * до текущего момента
     */
    updateLotsRemaindersTime: function () {
        var lotId, lotRemainderTime,
            timeout, diff, cnt;

        if (this.dataOfLots == null) {
            return;
        }

        for (lotId in this.dataOfLots) {

            if (!this.dataOfLots.hasOwnProperty(lotId)) {
                continue;
            }

            lotRemainderTime = this.dataOfLots[lotId];

            timeout = this._intervalTimeOfUpdateLotsRemaindersTimers;
            diff = this.getPresentTime() - this.__lastTimestampLoadDataLots - timeout;
            cnt = Math.floor(diff / timeout);

            // отсчет добавления секунд ведеться от последнего обновления лотов
            // возможный косяк
            lotRemainderTime = this.addSecondsTo(lotRemainderTime, 0 - (cnt + 1));


            this.setLotReminderTime(lotId, lotRemainderTime);
        }
    },

    startTimerUpdateLotsRemaindersTime: function () {
        var start = this.getPresentTime(),
            timeout = 1000;

        this.stopTimerUpdateLotsRemaindersTime();

        function updateTime () {
            var diff, cnt;

            diff = this.getPresentTime() - start - timeout;
            cnt = Math.floor(diff / timeout);

            if (this._serverTime) {
                this._serverTime.setSeconds(this._serverTime.getSeconds() + cnt + 1);
                this.signalServerTimeUpdated(this._serverTime);
            }

            this.updateLotsRemaindersTime();

            diff = diff - timeout * cnt;
            start = this.getPresentTime() - diff;

            this.__timerOfUpdateLotsRemainderTime = setTimeout(
                updateTime.bind(this),
                (timeout - diff)
            );
        }

        updateTime.call(this);
    },

    stopTimerUpdateLotsRemaindersTime: function () {
        clearTimeout(this.__timerOfUpdateLotsRemainderTime);
    },

    /**
     * Проверка завершены ли торги или нет?
     * @param remainingTime {timestamp}
     * @private
     * @return {Boolean}
     */
    _isTimeOver: function (remainingTime) {
        var _remainingTime = remainingTime || this._remainderTime;

        return _remainingTime.Hours <= 0
            && _remainingTime.Minutes <= 0
            && _remainingTime.Seconds <= 0;
    },

    /**
     * Сигнал о завершении торгов
     * @override
     */
    signalTimeIsOver: function () { },

    /**
     * Запрос к серверу для получения серверного времени обвалился или пришел неверный ответ
     * @override
     */
    signalServerResponseFail: function () { },

    /**
     * Сигнал о завершении оновления серверного времени
     * @override
     */
    signalServerTimeUpdated: function () {
        //this.showServerTime();
        //this.showRemainingTime();
    },

    /**
     * Сигнал о закрытии лота
     * @param lotId {Number|String} - идентификатор лота
     * @param lotRemainderTime {timestamp} остаток времени по лоту
     * @override
     */
    signalLotIsClose: function (lotId, lotRemainderTime) {

    },

    /**
     * Сигнал об открытом лоте
     * @param lotId {Number|String} - идентификатор лота
     * @param lotRemainderTime {timestamp} остаток времени по лоту
     * @override
     */
    signalLotIsOpen: function (lotId, lotRemainderTime) {

    },

    /**
     * Сигнал об обновлении лота
     * @param lotId {Number|String} - идентификатор лота
     * @param lotRemainderTime {timestamp} остаток времени по лоту
     * @override
     */
    signalLotUpdate: function (lotId, lotRemainderTime) {

    },

    /**
     * Изменение оставшегося времени отсносительно времени отсчета (старта)
     * (Вычитание)
     * @param timeFrom {timestamp} - от какого времени вести отчет
     * @param remainderTime {timestamp} - время к которому нужно прибавить количествопройденных секунд
     * @return {timestamp} - время сколько осталось
     */
    getRemainderTime: function (timeFrom, remainderTime) {
        var start, diffTime, diffSec;

        start = timeFrom;

        // сколько прошло времени с последнего запроса лотов
        diffTime = (this.getPresentTime() - start);

        // количество секунд с прошедших за это время
        diffSec = Math.floor(diffTime / 1000);

        // расчет прошедших секунд со времени старта
        // вычитаем из времени старта, для получения времени оставшегося
        return this.addSecondsTo(remainderTime, 0 - (diffSec + 1));
    },

    /**
     * Получить текущее время
     */
    getPresentTime: function () {
        return new Date().getTime();
    },

    /**
     * Добавление секунд к указанному времени
     * @param timeSpan {timestamp} указанное время
     * @param s {Number} сколько секунд надо добавить
     * @returns {timestamp}
     */
    addSecondsTo: function (timeSpan, s) {

        var ts = timeSpan.Hours * 3600;
        ts += timeSpan.Minutes * 60;
        ts += timeSpan.Seconds;

        ts += s;

        var h = ~~(ts / 3600);
        ts = ts % 3600;
        var m = ~~(ts / 60);
        ts = ts % 60;

        timeSpan.Hours = h;
        timeSpan.Minutes = m;
        timeSpan.Seconds = ts;
        return timeSpan;
    }
};


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
        processLotsSelector: "#lots-table tr[id]:not(.lot-disable)",
        serverTimeSelector: "#server-clock",
        remainingTimeSelector: "#auction-end-clock, .auction-end-clock ",
        remainingTimeLotSelector: '#lot-end-clock-',
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

        if (this.options.mode == "org") {
            $('#bootstrap_alert').appendAlert(this.options.message + '<span class="auction-end-clock"></span>)', 'warning');
        }

        this.$serverTimeElement = $(this.options.serverTimeSelector);
        this.$remainingTimeElement = $(this.options.remainingTimeSelector);

        this.lotTimer = new LotTimer(this.options);

        this.lotTimer.signalLotIsClose = function (lotId, lotRemainderTime) {
            $(options.remainingTimeLotSelector + lotId)
                .text(getClockString(lotRemainderTime.Hours, lotRemainderTime.Minutes, lotRemainderTime.Seconds));
        };

        this.lotTimer.signalLotIsOpen = function (lotId, lotRemainderTime) {
            $(options.remainingTimeLotSelector + lotId)
                .text(getClockString(lotRemainderTime.Hours, lotRemainderTime.Minutes, lotRemainderTime.Seconds));
        };

        this.lotTimer.signalServerTimeUpdated = function (serverTime) {
            console.log("this.lotTimer.signalServerTimeUpdated", serverTime);
            $(options.serverTimeSelector)
                .text(getClockString(serverTime.getHours(), serverTime.getMinutes(), serverTime.getSeconds()));
        };
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