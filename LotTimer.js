/**
 * Класс вычислений оставшегося времени для лотов
 * Время синхронезируется с сервером
 * @constructor
 * @dependencies {jQuery}
 * @param options {Object} - настройки
 */
function LotTimer (options) {

    this._syncUrl = options.syncUrl;
    this._durationMode = options._durationMode;

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
     * Возаращает URL со случайным параметром, чтобы не кешировать
     * ответ от сервера, даже если он не поддерживает ETag
     * @param url {String} - URL запроса
     * @private
     */
    _getURLWithCMD: function (url) {
        return url + '?' + Date.now();
    },

    /**
     * Синхронезация времени с сервером
     */
    syncServerTime: function () {
        var startSyncTime = this.getPresentTime();

        $.get(this._getURLWithCMD(this._syncUrl)
            .done(this._parseResponseServerTime.bind(this, startSyncTime)))
            .fail(this.signalServerResponseFail.bind(this));
    },

    _parseResponseServerTime: function (response, startSyncTime) {
        var timeSpentOnRequest;

        if ($.type(response) !== 'object' || !response.endTimeSpan) {
            this.signalServerResponseFail();
            return;
        }

        // вычисляеться время потраченное на отправление и полуение запроса от сервера
        // делиться на два - это интересно почему, видимо из практики вычитано
        timeSpentOnRequest = Math.floor((this.getPresentTime() - startSyncTime) / 2);

        // Вычисляеться еоличество прошедщих секунд по вычелсенному времени потраченному на запрос
        // и добавляеться к серверному времени
        this._remainderTime = this.addSecondsTo(response.endTimeSpan, Math.round(timeSpentOnRequest / 1000));

        if (this._isTimeOver()) {
            this.signalTimeIsOver();
            return;
        }

        this.setServerTime(response.dateTime);

    },

    /**
     * Сохранить серверное время
     * @param dataTime {Date}
     */
    setServerTime: function (dataTime) {

        if (dataTime) {
            this._serverTime = new Date(
                dataTime.Year,
                dataTime.Month - 1,
                dataTime.Day,
                dataTime.Hour,
                dataTime.Minute,
                dataTime.Second,
                dataTime.Millisecond + diffGetDate
            );
        }

        this.signalServerTimeUpdated();

        if (this._durationMode === 'ProlongationByLots') {
            this.getLotsServerTime();
        }
    },

    /**
     * Проверка завершены ли торги или нет?
     * @param remainingTime {timestamp}
     * @private
     * @return {Boolean}
     */
    _isTimeOver: function (remainingTime) {
        var _remainingTime = remainingTime || this._remainderTime;

        return _remainingTime.Hours == 0
            && _remainingTime.Minutes == 0
            && _remainingTime.Seconds == 0;
    },

    /**
     * Сигнал о завершении торгов
     * @override
     */
    signalTimeIsOver: function () {},

    /**
     * Запрос к серверу для получения серверного времени обвалился или пришел неверный ответ
     * @override
     */
    signalServerResponseFail: function () {},

    /**
     * Сигнал о завершении оновления серверного времени
     */
    signalServerTimeUpdated: function () {
        //this.showServerTime();
        //this.showRemainingTime();
    },

    /**
     * Получение данных лотов
     */
    getLotsData: function () {},

    /**
     * Получение оставшегося времени
     * @param timeFrom {timestamp} - от какого времени вести отчет
     * @return {timestamp} - время сколько осталось
     */
    getRemainderTime: function (timeFrom) {
        var start, diffTime, diffSec;

        // время последнего запроса лотов
        start = timeFrom;

        // сколько прошло времени с последнего запроса лотов
        diffTime = (this.getPresentTime() - start);

        // количество секунд с прошедших за это время
        diffSec = Math.floor(diffTime / 1000);

        // расчет прошедших секунд со времени старта
        // вычитаем из времени старта, для получения времени оставшегося
        return this.addSecondsTo(timeFrom, 0 - (diffSec + 1));
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