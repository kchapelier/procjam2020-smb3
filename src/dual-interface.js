"use strict";

const IPSMaker = require('./ips-maker');

/**
 * DualInterface constructor.
 * 
 * @param {UInt8Array} originalRom 
 * 
 * @constructor
 */
function DualInterface (originalRom) {
    this.ips = new IPSMaker();
    this.rom = originalRom.slice(); // copy the rom data
}

/**
 * Apply change on one byte of the ROM.
 * 
 * @param {integer} offset Position of the byte to change
 * @param {integer} value New value for the byte
 */
DualInterface.prototype.change = function (offset, value) {
    this.ips.addChange(offset, value);
    this.rom[offset] = value;
};

/**
 * Get the modified ROM.
 * 
 * @returns {UInt8Array}
 */
DualInterface.prototype.getRomFileData  = function () {
    return this.rom;
};

/**
 * Get the IPS patch containing all the changes.
 * 
 * @returns {UInt8Array}
 */
DualInterface.prototype.getIpsFileData  = function () {
    return this.ips.makePatch();
};

module.exports = DualInterface;