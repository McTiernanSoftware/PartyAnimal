/**
 * Super simple events library
 *
 * @author Mike McTiernan
 * @copyright 2013
 */


var McEvents = function() {
    this._index = -1;
    this._lookup = {};
    this._registry = {};
};


McEvents.prototype = {


    /**
     * Fire an event with optional parameters
     *
     * @param   {string}    evt - The name of the event type
     * @returns {Number}    The number of callbacks fired
     */
    trigger: function trigger(evt) {
        var idx,
            opts = Array.prototype.slice.call(arguments, 1),
            count = 0;

        if (evt in this._registry) {
            for (idx in this._registry[evt]) {
                if (this._registry[evt].hasOwnProperty(idx)) {
                    this._registry[evt][idx].apply(this, opts);
                    count++;
                }
            }
        }

        if (evt != "*") {
            opts.unshift("*");
            count += this.trigger.apply(this, opts);
        }
        return count;
    },


    /**
     * Register a callback to a given event
     *
     * @param   {string}    evt - The name of the event type
     * @returns {Number}    The identifier for the registered callback
     */
    on: function on(evt, callback) {
        var index = ++this._index;
        if (!(evt in this._registry)) {
            this._registry[evt] = {};
        }
        this._registry[evt][index] = callback;
        this._lookup[index] = evt;
        return index;
    },


    /**
     * Remove a callback from the registry based on its identifier
     *
     * @param   {number}    idx - The identifier of the registered callback
     * @returns {boolean}   True if the callback was registered.
     */
    off: function off(idx) {
        var evt;
        if (idx in this._lookup) {
            evt = this._lookup[idx];
            delete this._lookup[idx];
            delete this._registry[evt][idx];
            return true;
        }
        return false;
    }
};


module.exports = {
    init: function() {
        return new McEvents();
    }
};
