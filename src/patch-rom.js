"use strict";

const objectSets = {
    plain: {
        id: 0x01,
        dataOffset: 0x14000
    },
    fortress: {
        id: 0x02,
        dataOffset: 0x20000
    },
    hills: {
        id: 0x03,
        dataOffset: 0x16000
    },
    sky: {
        id: 0x04,
        dataOffset: 0x18000
    },
    plant: {
        id: 0x05,
        dataOffset: 0x1C000
    },
    water: {
        id: 0x06,
        dataOffset: 0x1A000
    },
    pipe: {
        id: 0x08,
        dataOffset: 0x1A000
    },
    desert: {
        id: 0x09,
        dataOffset: 0x1E000
    },
    ship: {
        id: 0x0A,
        dataOffset: 0x24000
    },
    giant: {
        id: 0x0B,
        dataOffset: 0x1C000
    },
    ice: {
        id: 0x0C,
        dataOffset: 0x18000
    },
    clouds: {
        id: 0x0D,
        dataOffset: 0x1C000
    },
    underground: {
        id: 0x0E,
        dataOffset: 0x10000
    },
    spade: {
        id: 0x0F,
        dataOffset: 0x00000
    },
    toadHouse: {
        id: 0x07,
        dataOffset: 0x1A000
    }
};

const offsets = {
    world1 : {
        label: "World 1 Map",
        tilesStart: 0x185BA,
        objectsYStart: 0x16070,
        objectsScreenStart: 0x160B8,
        objectsXStart: 0x16100,
        objectsTypeStart: 0x16148,
        objectsItemStart: 0x16190,
        pointersStart: 0x19434,
        animationFrameCount: 0x17C11,
        bottomBorderTile:0x18464,
        maxPanR: 0x14F44,
        musicOnEntry: 0x3C424,
        musicOnReturn: 0x143CA,
        palette: 0x1842D,
        marioInitialPos: 0x3C39A // only contain the start pos in Y, X is hardcoded to 0x20 in the game
    },
    general: {
        mapTilesDefinitionOffset: 0x18010,
        endMessage: 0x31AD9
    }
};

const romTypes = {
    E: 'E',
    Uprg0: 'Uprg0',
    unknown: 'unknown'
};

function getRomType(rom) {
    const diff1 = (rom[0x11E64] << 16) | (rom[0x11E65] << 8) | rom[0x11E66];
    const diff2 = (rom[0x11E5D] << 16) | (rom[0x11E5E] << 8) | rom[0x11E5F];

    // console.log('romtype', diff1.toString(16), diff2.toString(16));

    let type = romTypes.unknown;

    if (diff1 === 0xEE7005 && diff2 === 0x28A517) {
        type = romTypes.Uprg0;
    } else if (diff1 === 0xF0D018 && diff2 === 0xEE7005) {
        type = romTypes.E;
    }

    return type;
}


function setTileDefinition (file, tile, upLeftPattern, lowLeftPattern, upRightPattern, lowRightPattern) {
    const base = offsets.general.mapTilesDefinitionOffset + tile;
    file.change(base, upLeftPattern);
    file.change(base + 0x100, lowLeftPattern);
    file.change(base + 0x200, upRightPattern);
    file.change(base + 0x300, lowRightPattern);
}

function setWorldMapTile(file, offset, x, y, tile) {
    const screen = x / 16 | 0;
    x = x % 16;
    file.change(offset + x + y * 16 + screen * 16 * 9, tile);
}

function preparePointers (pointers) {
    const toSort = [];

    const preparedPointers = [
        [], [], [], []
    ];

    for (let i = 0; i < pointers.length; i++) {
        const pointer = pointers[i];

        const preparedPointer = {
            screen: pointer.x / 16 | 0,
            col: pointer.x % 16,
            row: pointer.y,
            objectSet: objectSets[pointer.set],
            objectOffset: pointer.objectData,
            enemyOffset: pointer.enemyData
        };

        toSort.push(preparedPointer);
    }

    toSort.sort(function (a, b) {
        let cmp = a.screen - b.screen;

        if (cmp == 0) {
            cmp = a.row - b.row;
        }

        if (cmp == 0) {
            cmp = a.col - b.col;
        }

        return cmp;
    });

    for (let i = 0; i < toSort.length; i++) {
        const pointer = toSort[i];

        pointer.pointerNum = i;

        preparedPointers[pointer.screen].push(pointer);
    }

    return preparedPointers;
}

function writeWord (file, position, value) {
    value = value & 0xFFFF;

    file.change(position, value & 0xFF);
    file.change(position + 1, (value & 0xFF00) >> 8);
}

function setWorldMapPointer2 (file, baseOffset, pointers, pointer, screen, col, row, objectSet, enemyOffset, objectOffset) {
    setWorldMapPointer(
        file,
        baseOffset, pointers, pointer, screen, col, row,
        objectSet.id, objectSet.dataOffset, enemyOffset, objectOffset
    );
}

const lockReplacePatterns = {
    roadVertical: 0xFEC0FEC0,
    roadHorizontal: 0xFEFEE1E1,
    bridge: 0xD4D6D5D7,
    black: 0xFFFFFFFF
};


function getVAddrForFortressFx(col, row) {
    const addr = 0x2880 + row * 0x40 + col * 0x02;
    const addrHi = (addr & 0xFF00) >> 8;
    const addrLo = addr & 0xFF;

    return [addrHi, addrLo];
}

function setLockData (file, horizontal, col, row, type) {
    const screen = col / 16 | 0;
    col = col % 16;

    // in [E] roms, the whole thing is offset by 6 bytes compared to [U] (PRG0) roms
    // writing it without the offset would not properly set the lock data
    // and would lead to the level complete flip animation to crash, fun stuff
    const romOffset = (type === romTypes.E ? 6 : 0);

    const [addrH, addrL] = getVAddrForFortressFx(col, row); // define place for graphical replace

    // console.log([addrH, addrL]);

    file.change(0x147CD + romOffset, addrH);
    file.change(0x147DE + romOffset, addrL);

    let graphicalPattern, logicalTile;

    if (horizontal) {
        graphicalPattern = lockReplacePatterns.roadHorizontal;
        logicalTile = 0x45;
    } else {
        graphicalPattern = lockReplacePatterns.roadVertical;
        logicalTile = 0x46;
    }

    file.change(0x14811 + 0 + romOffset, (graphicalPattern >>> 24) & 0xFF); // graph pattern to overwrite the current map graphics with
    file.change(0x14811 + 1 + romOffset, (graphicalPattern >>> 16) & 0xFF);
    file.change(0x14811 + 2 + romOffset, (graphicalPattern >>> 8) & 0xFF);
    file.change(0x14811 + 3 + romOffset, (graphicalPattern) & 0xFF);
    file.change(0x14877 + romOffset, logicalTile); // logical tile to use when the lock is simply overwritten graphically

    file.change(0x14855 + romOffset, (row + 2) << 4); // (row + 2) << 4
    file.change(0x14866 + romOffset, (col << 4) | screen); // (col << 4) | screen
    file.change(0x147EF + romOffset, col + screen * 16); // col (incl. +screen*16)
    file.change(0x147F0 + romOffset, 2**(7-row)); // 2**(7-row)
}

function setWorldMapPointer(file, pointersStart, pointersNumber, pointer, screen, col, row, objectSetId, objectSetOffset, enemyOffset, objectOffset) {
    enemyOffset = enemyOffset - 0x10;
    const enemyDataByte1 = (enemyOffset & 0x00FF);
    const enemyDataByte2 = (enemyOffset & 0xFF00) >> 8;
    const normalizedObjectdata = objectOffset - objectSetOffset - 0x10;
    const objectDataByte1 = (normalizedObjectdata & 0x00FF);
    const objectDataByte2 = (normalizedObjectdata & 0xFF00) >> 8;

    file.change(pointersStart + 4 + pointer, (row << 4) | objectSetId);
    file.change(pointersStart + 4 + 1 * pointersNumber + pointer, (screen << 4) | col);
    file.change(pointersStart + 4 + 2 * pointersNumber + pointer * 2, enemyDataByte1);
    file.change(pointersStart + 4 + 2 * pointersNumber + 1 + pointer * 2, enemyDataByte2);
    file.change(pointersStart + 4 + 4 * pointersNumber + pointer * 2, objectDataByte1);
    file.change(pointersStart + 4 + 4 * pointersNumber + 1 + pointer * 2, objectDataByte2);
}

function patchInNewTileDefinitions(file) {
    setTileDefinition(file, 0x80, 0x9B, 0xAE, 0x9A, 0xAF); // vertical river top end
    setTileDefinition(file, 0x81, 0xAC, 0x99, 0xAD, 0x98); // vertical river bottom end
    setTileDefinition(file, 0xAE, 0x9F, 0x1E, 0x9C, 0x94); // top left + top right + bottom right
    setTileDefinition(file, 0xAF, 0x10, 0x97, 0x9C, 0x94); // top right + bottom right + bottom left
    setTileDefinition(file, 0xB5, 0x9F, 0x97, 0x11, 0x94); // bottom right + bottom left + top left
    setTileDefinition(file, 0xB6, 0x9F, 0x97, 0x9C, 0x1F); // bottom left + top left + top right
}

function patchInWorldMetaData(file, map) {
    file.change(offsets.world1.palette, map.palette);
    file.change(offsets.world1.bottomBorderTile, map.bottomBorderTile);
    file.change(offsets.world1.maxPanR, 0x10 * map.screens);

    file.change(offsets.world1.musicOnEntry, map.music);
    file.change(offsets.world1.musicOnReturn, map.music);
    file.change(offsets.world1.animationFrameCount, map.animationFrameCount[0]);
    file.change(offsets.world1.animationFrameCount + 1, map.animationFrameCount[1]);
    file.change(offsets.world1.animationFrameCount + 2, map.animationFrameCount[2]);
    file.change(offsets.world1.animationFrameCount + 3, map.animationFrameCount[3]);
}

function patchInWorldMap(file, map) {
    for (let i = 0; i < map.length; i++) {
        const data = map.data[i];
        setWorldMapTile(file, offsets.world1.tilesStart, data.x, data.y, data.tileId);
    }

    file.change(offsets.world1.tilesStart + map.length, 0xFF); // end of map delimiter
}

function patchInWorldStartData(file, map) {
    const startData = map.start;
    file.change(offsets.world1.marioInitialPos, 0x20 + 0x10 * startData.y);
}

function patchInWorldLockData(file, map, type) {
    const lockData = map.lock;

    if (lockData) {
        setLockData(file, lockData.horizontal, lockData.x, lockData.y, type);
    }
}

function patchInWorldPointers(file, map) {
    const mapReferencesBaseOffset = 0x193DA;
    const mapReferencesBankOffset = 0xE000;
    const base = offsets.world1.pointersStart;

    const pointers = map.getAllPointers();
    const preparedPointers = preparePointers(pointers);

    // console.log(preparedPointers);

    const offsetScreen0 = 0x00;
    const offsetScreen1 = offsetScreen0 + preparedPointers[0].length;
    const offsetScreen2 = offsetScreen1 + preparedPointers[1].length;
    const offsetScreen3 = offsetScreen2 + preparedPointers[2].length;
    const pointerNumber = offsetScreen3 + preparedPointers[3].length

    file.change(base + 0, offsetScreen0); // offset to first pointer of first screen
    file.change(base + 1, offsetScreen1); // offset to first pointer of second screen
    file.change(base + 2, offsetScreen2); // offset to first pointer of third screen
    file.change(base + 3, offsetScreen3); // offset to first pointer of fourth screen

    const initIndexOffset = (base) - mapReferencesBankOffset - 0x10;
    const rowtypeOffset = (base + 4 + pointerNumber * 0) - mapReferencesBankOffset - 0x10;
    const screenColOffset = (base + 4 + pointerNumber * 1) - mapReferencesBankOffset - 0x10;
    const objectsOffset = (base + 4 + pointerNumber * 2) - mapReferencesBankOffset - 0x10;
    const levelLayoutsOffset = (base + 4 + pointerNumber * 4) - mapReferencesBankOffset - 0x10;

    writeWord(file, mapReferencesBaseOffset + 9 * 0, initIndexOffset);
    writeWord(file, mapReferencesBaseOffset + 9 * 2, rowtypeOffset);
    writeWord(file, mapReferencesBaseOffset + 9 * 4, screenColOffset);
    writeWord(file, mapReferencesBaseOffset + 9 * 6, objectsOffset);
    writeWord(file, mapReferencesBaseOffset + 9 * 8, levelLayoutsOffset);

    for (let s = 0; s < 4; s++) {
        const screenPointers = preparedPointers[s];

        for (let i = 0; i < screenPointers.length; i++) {
            const pointer = screenPointers[i];

            setWorldMapPointer2(
                file,
                base, pointerNumber, pointer.pointerNum,
                pointer.screen, pointer.col, pointer.row,
                pointer.objectSet, pointer.enemyOffset, pointer.objectOffset, 
            );
        }
    }
}

function patchInWorldSprites(file, map) {
    const objects = map.getAllSprites();

    for (let i = 0; i < 9; i++) {
        if (i < objects.length) {
            const object = objects[i];

            file.change(offsets.world1.objectsYStart + i, 0x20 + 0x10 * object.y);
            file.change(offsets.world1.objectsScreenStart + i, object.x / 16 | 0);
            file.change(offsets.world1.objectsXStart + i, 0x10 * (object.x % 16));
            file.change(offsets.world1.objectsTypeStart + i, object.sprite);
            file.change(offsets.world1.objectsItemStart + i, object.item);
        } else {
            file.change(offsets.world1.objectsYStart + i, 0x00);
            file.change(offsets.world1.objectsScreenStart + i, 0x00);
            file.change(offsets.world1.objectsXStart + i, 0x00);
            file.change(offsets.world1.objectsTypeStart + i, 0x00);
            file.change(offsets.world1.objectsItemStart + i, 0x00);
        }
    }
}

function patchOutBigQuestionBlocks (file) {
    //world3-level5: neutralize BigQ pipe
    file.change(0x2514A, 0xA1);

    //world3-level9: neutralize BigQ pipe
    file.change(0x1F18A, 0xA1);

    // world4-fortress2: remove door to pipe zone
    file.change(0x2B658, 0x58);
    file.change(0x2B65A, 0x50);

    //world5-level2: neutralize BigQ pipe
    file.change(0x1A65F, 0xA2);

    //world5-level5: neutralize BigQ pipe
    file.change(0x22F7D, 0xA3);

    //world6-level3: neutralize BigQ pipe
    file.change(0x22B19, 0xA2);

    //world6-level10: neutralize BigQ pipe
    file.change(0x23A92, 0xA1);

    // world7-fortress1: neutralize BigQ pipe
    file.change(0x2B471, 0xA1);

    // world7-level8: neutralize BigQ pipe
    file.change(0x1F067, 0xA1);

    // world8-level1: neutralize BigQ pipe
    file.change(0x1F7F3, 0xA8);
}

function patchOutWhiteblockTrick (file, type) {
    // replace the increment of the ducked-while-holding-a-shell-on-a-white-block counter by NOPs
    if (type === romTypes.Uprg0) {
        file.change(0x11E64, 0xEA);
        file.change(0x11E65, 0xEA);
        file.change(0x11E66, 0xEA);
    } else if (type === romTypes.E){
        file.change(0x11E5D, 0xEA);
        file.change(0x11E5E, 0xEA);
        file.change(0x11E5D, 0xEA);
    }
}

function patchInEndMessage (file) {
    const invMapping = {
        "A": 0xB0, 
        "B": 0xB1, 
        "C": 0xB2, 
        "D": 0xB3, 
        "E": 0xB4, 
        "F": 0xB5, 
        "G": 0xB6, 
        "H": 0xB7, 
        "I": 0xB8, 
        "J": 0xB9, 
        "K": 0xBA, 
        "L": 0xBB, 
        "M": 0xBC, 
        "N": 0xBD, 
        "O": 0xBE, 
        "P": 0xBF, 
        "Q": 0xC0, 
        "R": 0xC1, 
        "S": 0xC2, 
        "T": 0xC3, 
        "U": 0xC4, 
        "V": 0xC5, 
        "W": 0xC6, 
        "X": 0xC7, 
        "Y": 0xC8, 
        "Z": 0xC9, 
        "a": 0xD0, 
        "b": 0xD1, 
        "c": 0xD2, 
        "d": 0xD3, 
        "e": 0xD4, 
        "f": 0xD5, 
        "g": 0xD6, 
        "h": 0xD7, 
        "i": 0xD8, 
        "j": 0xD9, 
        "k": 0xDA, 
        "l": 0xDB, 
        "m": 0xDC, 
        "n": 0xDD, 
        "o": 0xDE, 
        "p": 0xDF, 
        "q": 0xCA, 
        "r": 0xCB, 
        "s": 0xCC, 
        "t": 0xCD, 
        "u": 0xCE, 
        "v": 0xCF, 
        "w": 0x81, 
        "x": 0x88, 
        "y": 0x8C, 
        "z": 0x8F, 
        ",": 0x9A, 
        ".": 0xE9, 
        "'": 0xAB,
        "!": 0xEA, 
        "?": 0xEB, 
        "_": 0xFE,
        "1": 0x9D,
        "2": 0x9E,
        "3": 0x9F,
        "#": 0x04, // custom char tile
        "-": 0x05 // custom char tile, not used in the end
    };

    const message = `
        Sorry_Mario.___
        This_isnt_your_
        world._________
        _______________
        ___#PROCJAM2O2O
        _______________
    `.replace(/[\r\n\s]+/g, '');

    const startPos = offsets.general.endMessage;

    for (let i = 0; i < message.length; i++) {
        if (invMapping.hasOwnProperty(message[i])) {
            file.change(startPos + i, invMapping[message[i]]);
        } else {
            file.change(startPos + i, 0xFC); // colored square to mark the issue
        }
    }
}

function patchInAdditionalCharacters (file) {
    const newData = [0xF3, 0x93, 0x81, 0x13, 0x91, 0x03, 0x93, 0x9F, 0xF3, 0x93, 0x81, 0x13, 0x91, 0x03, 0x93, 0x9F, 0xFF, 0xFF, 0xFF, 0xFF, 0x87, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x87, 0xFF, 0xFF, 0xFF];

    const startPos = 0x57050;

    for (let i = 0; i < newData.length; i++) {
        file.change(startPos + i, newData[i]);
    }
}

function patchRom(rom, file, map) {
    const type = getRomType(rom);

    if (type === romTypes.unknown) {
        alert('Unrecognized ROM type. The hack may not work correctly on this ROM.');
        type = romTypes.Uprg0;
    }

    // replace unused tiles with missing water tiles to cover all the the autotiling cases
    patchInNewTileDefinitions(file);

    // replace the pipes to the "Big Question Block" in the level data
    patchOutBigQuestionBlocks(file);

    // remove the ability to get behind the background by ducking with a shell on a white block
    patchOutWhiteblockTrick(file, type);

    // set palette, bottom border tile, maxPan, music and animation frame counts
    patchInWorldMetaData(file, map);

    // define the actual map, set the eventual lock data and start position
    patchInWorldMap(file, map);
    patchInWorldLockData(file, map, type);
    patchInWorldStartData(file, map);

    // define the pointers in the map (level entry data)
    patchInWorldPointers(file, map);

    // define sprites in world map (hammer brother and "help!" bubble)
    patchInWorldSprites(file, map);

    // replace unused tiles with "-" and "#" characters for the end message
    patchInAdditionalCharacters(file);

    // custom end message for Peach
    patchInEndMessage(file);
}

module.exports = patchRom;