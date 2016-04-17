function IndexController () {
    this.$container = document.getElementById('container');
    this.worker = new Worker('worker.js');

    this.worker.addEventListener('message', function(event) {
        var data = event.data;

        if (data.error) {
            console.log(data.error);
        }

        if (data.html) {
            this.onRender(data.html);
        }
    }.bind(this), false);

}

IndexController.prototype = {

    init: function () {
        this.worker.postMessage({cmd:'start'});
    },

    stop: function () {
        this.worker.postMessage({cmd:'stop'});
    },

    onRender: function (html) {
        this.$container.innerHTML = html;
    }
};


