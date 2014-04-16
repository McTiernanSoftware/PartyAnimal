/**
 * Example load script
 *
 * Makes a request to the Facebook Graph API for my profile information every
 * second.
 *
 * @author Mike McTiernan
 * @copyright 2013
 */


var request = require("request");


var Script = function() {
    this.successes = 0;
    this.failures = 0;
    this.totalRequestTime = 0;
}


Script.prototype = {
    now: function() {
        return Date.now() / 1000;
    },
    step: function() {
        var script = this,
            start = this.now();
        request("http://graph.facebook.com/mikemct", function(error, response, body) {
            script.totalRequestTime += script.now() - start;
            if (!error && response.statusCode == 200) {
                script.successes++;
            } else {
                script.failures++;
            }
        });
    },
    stop: function() {
        if (this.interval) {
            clearInterval(this.interval);
        }
    },
    run: function() {
        var script = this,
            start = Date.now() / 1000;

        script.interval = setInterval(function() {
            script.step();
        }, 1000);
    }
};


module.exports = {
    init: function() {
        return new Script();
    }
};
