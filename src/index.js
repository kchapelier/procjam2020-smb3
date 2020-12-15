"use strict";

const DualInterface = require('./dual-interface');
const parseUrlQuery = require('./parse-url-query');
const generateMap = require('./generate-map');
const patchRom = require('./patch-rom');

const expectedSize = 393232;
const expectedHeader = [0x4E, 0x45, 0x53, 0x1A, 0x10, 0x10, 0x40, 0x00]; // NES\x1A 16 16 4<<4

/**
 * Bare minimum check of the ROM validity.
 * 
 * @param {UInt8Array} data 
 * @returns {boolean}
 */
function checkRom (data) {
    let valid = data.length === expectedSize;

    for (let i = 0; i < expectedHeader.length && valid; i++) {
        valid = data[i] === expectedHeader[i];
    }

    return valid;
}

/**
 * Return an object URL for the given blob or "blobable" parts.
 * 
 * @param {array|Blob} contents 
 * @param {string} [type]
 * @returns {string} Object URL as a string
 */
function getObjectUrl (contents, type) {
    let blob;

    if (typeof contents === 'object' && contents.constructor.name === 'Blob') {
        blob = contents;
    } else {
        blob = new Blob(contents, {
            type: type
        });
    }

    return URL.createObjectURL(blob);
}

function main () {
    const fileLink = document.querySelector('#fileLink');
    const fileInput = document.querySelector('#fileInput');
    const downloadRomLink = document.querySelector('#download-rom');
    const downloadIpsLink = document.querySelector('#download-ips');

    const urlOptions = parseUrlQuery();

    const version = 'A';
    let rom = null;

    const steps = [...document.querySelectorAll('.step')];

    function setCurrentStep (currentStep) {
        steps.forEach(function (element) {
            if (element.getAttribute('data-step') === currentStep) {
                element.classList.add('active');
                element.setAttribute('aria-disabled', 'false');
            } else {
                element.classList.remove('active');
                element.setAttribute('aria-disabled', 'true');
            }
        });
    }

    setTimeout(function () {
        setCurrentStep('provide-rom');
    }, 500);

    fileLink.addEventListener('click', function (e) {
        e.preventDefault();
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        const files = fileInput.files;
        const reader = new FileReader();
    
        if (files.length) {
            reader.onload = function (e) {
                const fileName = files[0].name;
                const data = new Uint8Array(e.target.result);
    
                if (checkRom(data)) {
                    rom = data;

                    setTimeout(function () {
                        const seed = urlOptions.seed !== null ? urlOptions.seed : 60 + Math.random() * 9999940 | 0;
                        const map = generateMap(seed);
                        const fileInterface = new DualInterface(rom);
                        patchRom(rom, fileInterface, map);
                        downloadRomLink.setAttribute('href', getObjectUrl([fileInterface.getRomFileData()], 'application/octet-stream'));
                        downloadRomLink.setAttribute('download', fileName.replace(/\.([^.]+)$/, ' [prh v' + version + ' seed' + seed + ']') + '.nes');
                        downloadIpsLink.setAttribute('href', getObjectUrl([fileInterface.getIpsFileData()], 'application/octet-stream'));
                        downloadIpsLink.setAttribute('download', fileName.replace(/\.([^.]+)$/, ' [prh v' + version + ' seed' + seed + ']') + '.ips');
                        setCurrentStep('download');
                    }, 200);
                } else {
                    alert('Invalid ROM file, please provide an unmodified SMB3 ROM file.');
                }
            };

            reader.readAsArrayBuffer(files[0]);
        }
    });
}

module.exports = main;