"use strict";

/**
 * MapArray constructor.
 * 
 * @param {integer} screens Number of screens the map spans.
 * 
 * @constructor
 */
function MapArray (screens) {
    this.screens = screens;
    this.minX = 0;
    this.maxX = screens * 16 - 1;
    this.minY = 0;
    this.maxY = 8;
    this.length = screens * 16 * 9;
    this.data = new Array(this.length);
    this.connections = new Array(this.length);

    for(let i = 0; i < this.length; i++) {
        this.connections[i] = 0;
    }

    this.start = null;
    this.lock = null;

    // define defaults
    this.useMargin = false;
    this.palette = 0;
    this.bottomBorderTile = 0x4F;
    this.music = 0x01;
    this.animationFrameCount = [0x10, 0x10, 0x10, 0x10];
}

MapArray.prototype.inBounds = function (x, y) {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
};

MapArray.prototype.getData = function (x, y) {
    if (this.inBounds(x, y)) {
        return this.data[x+y*16*this.screens];
    }
};

MapArray.prototype.setData = function (x, y, tile, branch, dist, branchDist) {
    if (this.inBounds(x, y)) {
        this.data[x+y*16*this.screens] = {
            x: x,
            y: y,
            depth: null,
            tile: tile,
            branch: branch,
            dist: dist,
            branchDist: branchDist,
            sprite: null,
            spriteItem: null,
            pointerSet: null,
            pointerObject: null,
            pointerEnemy: null
        };
    }
};

MapArray.prototype.setDepth = function (x, y, depth) {
    if (this.inBounds(x, y)) {
        this.data[x + y * 16 * this.screens].depth = depth;
    }
};

MapArray.prototype.getConnectionsNumber = function (x, y) {
    if (this.inBounds(x, y)) {
        return this.connections[x + y * 16 * this.screens];
    }
};

MapArray.prototype.setConnectionsNumber = function (x, y, v) {
    if (this.inBounds(x, y)) {
        this.connections[x + y * 16 * this.screens] = v;
    }
};

MapArray.prototype.increaseConnectionsNumber = function (x, y, v) {
    if (this.inBounds(x, y)) {
        this.connections[x+y*16*this.screens] += v;
    }
};

MapArray.prototype.clone = function () {
    const n = new MapArray(this.screens);

    n.connections = Array.from(this.connections);
    n.data = JSON.parse(JSON.stringify(this.data));

    return n;
};

MapArray.prototype.setStartData = function (x, y) {
    this.start = {
        x: x,
        y: y
    };
};

MapArray.prototype.setLockData = function (horizontal, x, y) {
    this.lock = {
        horizontal: horizontal,
        x: x,
        y: y
    };
}

MapArray.prototype.getAllSprites = function () {
    const sprites = [];

    for (let i = 0; i < this.length; i++) {
        const data = this.data[i];
        if (data.sprite !== null) {
            sprites.push({
                x: data.x,
                y: data.y,
                sprite: data.sprite,
                item: data.spriteItem
            });
        }
    }

    return sprites;
};

MapArray.prototype.getAllPointers = function () {
    const pointers = [];

    for (let i = 0; i < this.length; i++) {
        const data = this.data[i];
        if (data.pointerObject !== null) {
            pointers.push({
                x: data.x,
                y: data.y + 2,
                set: data.pointerSet,
                objectData: data.pointerObject,
                enemyData: data.pointerEnemy,
            });
        }
    }

    return pointers;
};

MapArray.prototype.setUseMargin = function (useMargin) {
    // console.log('setUseMargin', useMargin);
    this.useMargin = useMargin;
};

MapArray.prototype.setBottomBorderTile = function (tile) {
    // console.log('setBottomBorderTile', tile);
    this.bottomBorderTile = tile;
};

MapArray.prototype.setMusic = function (music) {
    // console.log('setMusic', music);
    this.music = music;
};

MapArray.prototype.setAnimationFrameCount = function (frame1, frame2, frame3, frame4) {
    // console.log('setAnimationFrameCount', frame1, frame2, frame3, frame4);
    this.animationFrameCount[0] = frame1;
    this.animationFrameCount[1] = frame2;
    this.animationFrameCount[2] = frame3;
    this.animationFrameCount[3] = frame4;
};

MapArray.prototype.setMapPalette = function (palette) {
    // console.log('setMapPalette', palette);
    this.palette = palette;
}

module.exports = MapArray;