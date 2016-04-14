/**
 * Класс вычислений оставшегося времени для лотов
 * Время синхронезируется с сервером
 * @constructor
 */
function LotTimer () {

    this._serverTime;

}

LotTimer.prototype = {

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
     * Синхронезауия времени с сервером
     */
    syncServerTime: function () {},

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