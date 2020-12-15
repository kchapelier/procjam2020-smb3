"use strict";

function lcg (seed) {
    let state = seed % 2147483647;

    return function () {
        state = (state * 48271) % 2147483647;
        return state / 2147483647;
    };
}

module.exports = lcg;