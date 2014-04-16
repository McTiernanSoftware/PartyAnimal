/**
 * PartyAnimal Receiver
 *
 * Spawns "user" scripts in response to commands from the Director script
 *
 * @author Mike McTiernan <mike@mikemct.com>
 * @copyright 2013
 */


var os = require("os");
var cluster = require("cluster");
var config = require("./config.js");
var pubnub = require("pubnub").init({
    publish_key: config.pubnub.publish_key,
    subscribe_key: config.pubnub.subscribe_key
});


var Receiver = function() {
    this.pubnub = pubnub;
    this.workers = [];
    this.scheduledTasks = [];
    this.reportInterval;
    this.stats = [];
    this.successes = 0;
    this.failures = 0;
    this.totalRequestTime = 0;
    this.origin = os.hostname();

    if (cluster.isWorker) {
        this.origin += ":" + cluster.worker.id;
    }
};


/**
 * Spawn a new "worker"
 *
 * @param   {string}    type - The type of worker to spawn (default: "default")
 * @returns {object}    An instance of the worker
 */
Receiver.prototype.spawn = function spawn(type) {
    var self = this,
        worker;

    if (!type) type = "default";
    type = type.replace(/\W/g, '');

    worker = require("./scripts/" + type + ".js").init();
    worker.run();

    this.workers.push(worker);
    return worker;
};


/**
 * Collect request data from all workers and broadcast stats back to director
 */
Receiver.prototype.report = function report() {
    var self = this,
        requestTime;

    this.workers.forEach(function(worker) {
        var workerSuccesses = worker.successes;
        var workerFailures = worker.failures;
        var workerRequestTime = worker.totalRequestTime;

        self.successes += workerSuccesses;
        self.failures += workerFailures;
        self.totalRequestTime += workerRequestTime;

        worker.successes -= workerSuccesses;
        worker.failures -= workerFailures;
        worker.totalRequestTime -= worker.totalRequestTime;
    });

    requestTime = this.totalRequestTime / (this.successes + this.failures);

    this.pubnub.publish({
        channel: config.pubnub.channel,
        message: {
            "origin": this.origin,
            "event": "report",
            "body": {
                "workers": this.workers.length,
                "successes": this.successes,
                "failures": this.failures,
                "requestTime": requestTime.toFixed(3),
                "currentTime": Math.round((new Date()).getTime() / 1000)
            }
        }
    });
}


/**
 * Begin listening for instructions from director
 */
Receiver.prototype.listen = function listen() {
    var receiver = this;
    this.pubnub.subscribe({
        channel: config.pubnub.channel,
        connect: function() {
            console.log("Receiver " + receiver.origin + " listening for events.");
        },
        callback: function(message) {
            if (message.origin == "receiver") return;
            switch (message.event) {
            case "ping":
                pubnub.publish({
                    channel: config.pubnub.channel,
                    message: {
                        "origin": receiver.origin,
                        "event": "pong",
                        "body": "PONG"
                    }
                });
                break;
            case "start":
                var start = (message.body.delay * 1000),
                    increment = (message.body.duration * 1000) / message.body.workers;

                console.log("Starting workers...");
                for (var i = 0; i < message.body.workers; ++i) {
                    receiver.scheduledTasks.push(setTimeout(function() {
                        receiver.spawn(message.body.type);
                    }, start));
                    start += increment;
                }

                if (!receiver.reportInterval) {
                    receiver.reportInterval = setInterval(function() {
                        receiver.report();
                    }, 15000);
                }
                break;
            case "stop":
                console.log("Stopping workers.");
                receiver.scheduledTasks.forEach(function(timeoutId) {
                    clearTimeout(timeoutId);
                });
                receiver.scheduledTasks.length = 0;
                if (receiver.reportInterval) {
                    clearInterval(receiver.reportInterval);
                    receiver.reportInterval = null;
                }
                receiver.report();
                receiver.workers.forEach(function(worker) {
                    worker.stop();
                });
                receiver.workers = [];
                receiver.successes = 0;
                receiver.failures = 0;
                receiver.totalRequestTime = 0;

                break;
            }
        }
    });
}


if (require.main === module) {
    if (cluster.isMaster) {
        console.log("Forking " + os.cpus().length + " receivers.");
        for (var i = 0; i < os.cpus().length; ++i) {
            cluster.fork();
        }
    } else {
        console.log("Receiver " + cluster.worker.id + " starting up...");
        var receiver = new Receiver();
        receiver.listen();
    }
}
