/**
 * PartyAnimal Director
 *
 * Provides a REPL console used for sending commands to any listening workers.
 * This library was designed to provide scale testing for services behind an
 * AWS Elastic Load Balancer. ELBs are provisioned with minimal resources and
 * scale up over time to handle increased work load. PartyAnimal enables a
 * developer to create load on a server that scales up over time.
 *
 * @author Mike McTiernan <mike@mikemct.com>
 * @copyright 2013
 */


var fs = require("fs");
var repl = require("repl");
var config = require("./config.js");
var pubnub = require("pubnub").init({
    publish_key: config.pubnub.publish_key,
    subscribe_key: config.pubnub.subscribe_key
});
var McEvents = require("./mcevents.js");


var Director = function() {
    var self = this;
    this.events = McEvents.init();
    this.pubnub = pubnub;
    this.isCounting = false;
    this.serverCount = 0;
    this.scriptType = "default";
    this.workers = 0;
    this.duration = 0;
    this.delay = 0;


    /**
     * Register catchall event for debugging
     */
    this.events.on("*", function(message) {
        if (message.origin == "director") return;
        console.log("Received message: " + JSON.stringify(message));
    });


    /**
     * Register callback to log reports
     */
    this.events.on("report", function(message) {
        fs.appendFile(
            config.result_log,
            JSON.stringify(message.body) + "\n"
        );
    });


    /**
     * Subscribe to the PubNub channel and register callback
     */
    this.pubnub.subscribe({
        channel: config.pubnub.channel,
        callback: function(message) {
            self.events.trigger(message.event, message);
        }
    });
};


/**
 * Send a message to listening workers
 *
 * @param   {string}    event - The name of the event to send
 * @param   {mixed}     message - The message body (typically an object)
 */
Director.prototype.send = function send(event, message) {
    if (!message) message = "";
    this.pubnub.publish({
        channel: config.pubnub.channel,
        message: {
            "origin": "director",
            "event": event,
            "body": message
        }
    });
};


/**
 * Convenience function for pinging receivers
 */
Director.prototype.ping = function ping() {
    this.send("ping");
};


/**
 * Detect all listening workers
 *
 * @param   {function}  callback - The function to call when counting is done
 * @returns {Number}    The count of listening workers
 */
Director.prototype.discover = function discover(callback) {
    var self = this,
        count = 0,
        eventId;

    if (this.isCounting) {
        setTimeout(function() {
            self.discover(callback);
        }, 1000);
        return;
    }
    this.isCounting = true;

    eventId = this.events.on("pong", function(message) {
        count++;
    });
    this.ping();
    setTimeout(function() {
        self.events.off(eventId);
        self.isCounting = false;
        self.serverCount = count;
        if (callback) callback(count);
    }, 1000);
    return;
}


/**
 * Provide an interactive console for sending commands
 */
Director.prototype.console = function console() {
    var self = this;
    var r = repl.start({
        prompt: "PartyAnimal> ",
        ignoreUndefined: true
    });
    r.context.director = this;
    r.on("exit", function() {
        self.send("stop");
        self.pubnub.unsubscribe({
            channel: config.pubnub.channel
        });
    });
    return r;
};


/**
 * Start a scale test.
 *
 * @param   {object}    manifest - Optional. Updates workers, duration, and delay
 */
Director.prototype.start = function start(manifest) {
    var diff = 0,
        prop;

    if (this.isCounting) return false;
    if (!manifest) manifest = {};
    for (prop in manifest) {
        if (manifest.hasOwnProperty(prop)) {
            this[prop] = manifest[prop];
        }
    }

    diff = this.workers % this.serverCount;
    if (diff) this.workers -= diff;
    this.send("start", {
        "type": this.scriptType,
        "workers": this.workers / this.serverCount,
        "duration": this.duration,
        "delay": this.delay
    });
};


/**
 * Send a STOP message to all listening receivers
 */
Director.prototype.stop = function() {
    this.send("stop");
};


module.exports = Director;


if (require.main === module) {
    var director = new Director;
    var r = director.console();
    r.on("exit", function() {
        process.exit(0);
    });
}
