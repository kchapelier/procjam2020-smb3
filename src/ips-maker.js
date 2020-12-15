"use strict";

/**
 * IPSMaker constructor.
 * 
 * @constructor
 */
function IPSMaker () {
    this.changes = [];
    this.priority = 0;
}

/**
 * Add a byte change.
 * 
 * @param {integer} offset Offset in the file (in the 0x000000 to 0xFFFFFF range)
 * @param {integer} value Value of the byte (in the 0x00 to 0xFF range)
 */
IPSMaker.prototype.addChange = function (offset, value) {
    if (offset > 0xFFFFFF || offset < 0x00) {
        throw new Error('IPSMaker.addChange: incorrect offset, must be in range 0x00 to 0xFF');
    }

    if (value > 0xFF || value < 0x00) {
        throw new Error('IPSMaker.addChange: incorrect value, must be in range 0x00 to 0xFF');
    }

    this.changes.push({
        offset: offset,
        value: value,
        priority: this.priority
    });

    this.priority++;
};

/**
 * Aggregate all changes, concatenating contiguous changes and ignoring obsolete changes.
 * 
 * @protected
 */
IPSMaker.prototype.aggregateChanges = function () {
    this.changes.sort(function (a, b) {
        // sort by ascending offset
        let cmp = a.offset - b.offset;

        // if the offset are equal, sort by descending priority (higher priority first)
        if (cmp === 0) {
            cmp = b.priority - a.priority; 
        }

        return cmp;
    });

    const aggregatedChanges = [];
    let currentAggregatedChange = null;
    let previousOffset = 0;

    for (let i = 0; i < this.changes.length; i++) {
        const change = this.changes[i];

        if (currentAggregatedChange === null || change.offset > previousOffset + 1) {
            currentAggregatedChange = {
                offset: change.offset,
                data: [change.value]
            };
            aggregatedChanges.push(currentAggregatedChange);
            previousOffset = change.offset;
        } else if (change.offset === previousOffset + 1) {
            currentAggregatedChange.data.push(change.value);
            previousOffset = change.offset;
        }
    }

    // additional feature if this code is ever reused:
    // detect possible gain with RLE encoding and use it if beneficial
    // RLE chunks are always 8 bytes 
    // (offset chunk offset 3B + 0x0000 as chunk length 2B + value repetition 2B + value 1B)

    return aggregatedChanges;
};

/**
 * Prepare the IPS file data and returns it.
 * 
 * @returns {Uint8Array}
 */
IPSMaker.prototype.makePatch = function () {
    const aggregatedChanges = this.aggregateChanges();

    let size = 8; // PATCH + EOF marker

    for (let i = 0; i < aggregatedChanges.length; i++) {
        size += 5 + aggregatedChanges[i].data.length; // chunk header + data
    }

    const patch = new Uint8Array(size);
    let pos = 0;

    // PATCH marker
    patch[pos++] = 0x50;
    patch[pos++] = 0x41;
    patch[pos++] = 0x54;
    patch[pos++] = 0x43;
    patch[pos++] = 0x48;

    // each element of aggregatedChanges is a separate chunk
    for (let i = 0; i < aggregatedChanges.length; i++) {
        const changes = aggregatedChanges[i];

        if (changes.offset === 0x454F46) {
            console.log('IPSMaker: change with an offset of 0x454F46 will likely be interpreted as the EOF marker by patchers');
        }

        patch[pos++] = (changes.offset >> 16) & 0xFF;
        patch[pos++] = (changes.offset >> 8) & 0xFF;
        patch[pos++] = changes.offset & 0xFF;
        
        patch[pos++] = (changes.data.length >> 8) & 0xFF;
        patch[pos++] = changes.data.length & 0xFF;

        for (let k = 0; k < changes.data.length; k++) {
            patch[pos++] = changes.data[k] & 0xFF;
        }
    }

    // EOF marker
    patch[pos++] = 0x45;
    patch[pos++] = 0x4F;
    patch[pos++] = 0x46;

    return patch;
}

module.exports = IPSMaker;