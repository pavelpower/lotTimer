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
    this._lotStatusActiveText = options.lotStatusActiveText;
    this._lotStatusStopText = options.lotStatusStopText;



    this.syncServerTime();
    this.startRecursiveSyncServerTime();
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
     * Хранилище ссылок на закрытые лоты
     */
    _disableLots: {},

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

        $.get( this._getURLWithCMD(this._durationMode === 'ProlongationByLots' ?this._syncLotsUrl : this._syncUrl))
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
        // делиться на два - это потому, что сервер сформирует свое время и отдаст обратно
        // и его время должно отличаться только на половину времени отправки и получения запроса
        // отправка запроса -> сервер отдает свое текущее время ->  получение запроса.
        // время сервера отличаеться от времени запроса на половину длины времени от начала запроса
        // до получения ответа.
        timeSpentOnRequest = Math.floor((this.getPresentTime() - startSyncTime) / 2);

        // Вычисляеться количество прошедших секунд по вычелсенному времени потраченному на запрос
        // и добавляеться к серверному времени
        this._remainderTime = this.addSecondsTo(response.endTimeSpan, Math.round(timeSpentOnRequest / 1000));

        if (this._isTimeOver()) {
            this.stopRecursiveSyncServerTime();
            setTimeout(this.signalTimeIsOver.bind(this), 0);
            return;
        }

        this.setServerTime(response.dateTime, timeSpentOnRequest);

        if (response.lotsEndTime) {
            this.resolveLotsTime(response.lotsEndTime);
        }

        this.startTimerUpdateLotsRemaindersTime();
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

            setTimeout(this.signalServerTimeUpdated.bind(this, this._serverTime), 0);
        }
    },

    /**
     * Обновление данных времени лотов
     * @param data
     */
    resolveLotsTime: function (data) {
      /*
      [{
       endTime:{Days: 0, Hours: 9, Minutes: 13, Seconds: 3},
       lotId:806652312,
       isLotProlongated:boolean
      }],

      */
        this.dataOfLots = data;
    },

    /**
     * Обновление времени для всех лотов в хеше
     * путем вычисления времени прошедшего с момента последнего обноавления с сервера,
     * до текущего момента
     */
    updateLotsRemaindersTime: function (cnt) {
        var i, lot,
          data = this.dataOfLots,
          sec = 0 - (cnt + 1),
          timeIsOver = false,
          $htmlRow = {
              firstColumn: '',
              timeColumn: ''
          };

        if (data == null) {
            return;
        }

        // last index
        i = data.length - 1;
        // Для ускорения цикла используем за ход сразу 10 обновлений
        while (i > -1) {

            if (lot = data[i]) {

                timeIsOver = true;

                if (!lot.isTimeOver) {
                    this.addSecondsTo(lot.endTime, sec);

                    timeIsOver = lot.isTimeOver = this._isTimeOver(lot.endTime);

                    if (timeIsOver) {

                        // вызов события об отключении строки
                        setTimeout(function (lot) {
                            this.signalTimeIsOverForLot(lot);
                        }.bind(this, lot), 0);

                        lot.isTimeOver = true;
                    }

                    data[i] = lot;
                }

                $htmlRow = this.updateHtmlRow(lot, $htmlRow, timeIsOver);

            } else break;
            --i;
        }

        this.dataOfLots = data;

        this.signalLotsUpdated($htmlRow);
    },

    updateHtmlRow: function (lot, $htmlRow, timeIsOver) {
        $htmlRow.firstColumn = this.getHTMLRowFirstColumn(
                lot.lotId,
                !timeIsOver ? 'i-active' : 'i-pending',
                !timeIsOver ? this._lotStatusActiveText : this._lotStatusStopText)
            + $htmlRow.firstColumn;

        $htmlRow.timeColumn = (timeIsOver ? this.getHTMLRowEndTimeColumn() : this.getHTMLRowTimeColumn(lot.endTime))
            + $htmlRow.timeColumn;

        return $htmlRow;
    },

    getHTMLRowFirstColumn: function (lotId, cssClass, text) {
        return ['<div title="' + text + '" class="row-lot-', lotId, ' d-v-td">',
            '<i id="lot-status-', lotId, '" class="icon ' + cssClass + '"></i></div>'].join('');
    },

    getHTMLRowTimeColumn: function (remainingTime) {
        return ['<div class="d-v-td">',
            getClockString(
                remainingTime.Hours,
                remainingTime.Minutes,
                remainingTime.Seconds
            ),
            '</div>'].join('');
    },

    getHTMLRowEndTimeColumn: function () {
        return '<div class="d-v-td">00:00:00</div>';
    },

    /**
    * Запуск таймера локального перерасчета серверного времени
    * А так же переасчета оставшегося времени
    */
    startTimerUpdateLotsRemaindersTime: function () {
        var start = this.getPresentTime(),
            timeout = 1000;

        this.stopTimerUpdateLotsRemaindersTime();

        function updateTime() {
            var diff, cnt;

            diff = this.getPresentTime() - start - timeout;
            cnt = Math.floor(diff / timeout);

            if (this._remainderTime) {
                setTimeout(this.updateRemainingTime.bind(this, this.addSecondsTo(this._remainderTime, 0 - (cnt + 1))), 0);
                setTimeout(this.signalRemainingTimeUpdate.bind(this, this._remainderTime, this.dataOfLots), 0);
            }

            if (this._serverTime) {
                this._serverTime.setSeconds(this._serverTime.getSeconds(), 0 - (cnt + 1));
                setTimeout(this.signalServerTimeUpdated.bind(this, this._serverTime), 0);
            }

            diff = diff - timeout * cnt;
            start = this.getPresentTime() - diff;

            this.__timerOfUpdateLotsRemainderTime = setTimeout(
                updateTime.bind(this),
                (timeout - diff)
            );

            this.updateLotsRemaindersTime(cnt);
        }

        updateTime.call(this);
    },

    updateRemainingTime: function (remainingTime) {
        this._remainderTime = remainingTime;

        if (this._isTimeOver()) {
            this._remainderTime.Hours = 0;
            this._remainderTime.Minutes = 0;
            this._remainderTime.Seconds = 0;
            this.syncServerTime();
        }
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
     * Сигнал о завершении торгов для конкретного лота
     * @override
     */
    signalTimeIsOverForLot: function () { },

    /**
     * Запрос к серверу для получения серверного времени обвалился или пришел неверный ответ
     * @override
     */
    signalServerResponseFail: function () { },

    /**
     * Сигнал о завершении оновления серверного времени
     * @param serverTime {Date} Серверное время
     * @override
     */
    signalServerTimeUpdated: function (serverTime) {
        //this.showServerTime();
        //this.showRemainingTime();
    },

    /**
     * Сигнал обновления остаточного времени
     * @param remainingTime {Object} - остаточное время
     * @override
     */
    signalRemainingTimeUpdate: function (remainingTime, dataLots) {},

    /**
     * Завершено обновление времени лотов
     * @param hashLotsTime
     */
    signalLotsUpdated: function (hashLotsTime) {},

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
