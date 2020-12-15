"use strict";

const parseUrlQuery = require('./parse-url-query');
const generateMap = require('./generate-map');

function main () {
    const urlOptions = parseUrlQuery();

    const seed = urlOptions.seed !== null ? urlOptions.seed : 60 + Math.random() * 9999940 | 0;

    var map = generateMap(seed);
    var canvas = document.querySelector('canvas');
    canvas.width = canvas.width * map.screens;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var tilesetImg = document.querySelector('#dark-tileset');
    var spritesetImg = document.querySelector('#spriteset');

    function drawTile(data) {
        var tx = (data.tileId % 16) * 16;
        var ty = (data.tileId / 16|0)*16;
        ctx.drawImage(tilesetImg,tx,ty,16,16,data.x*32,data.y*32,32,32);

        if (data.sprite !== null) {
            tx = data.sprite * 16;
            ty = 0;
            ctx.drawImage(spritesetImg,tx,ty,16,16,data.x*32,data.y*32,32,32);
        }

        /*
        if (data.pointerObject !== null) {
            ctx.fillStyle = 'rgba(100,100,255,0.4)';
            ctx.fillRect(data.x*32,data.y*32,32,32);
            ctx.strokeStyle = 'rgb(0,0,255)';
            ctx.lineWidth = 2;
            ctx.strokeRect(data.x*32+1,data.y*32+1,32-2,32-2);
        }
        */
    }

    for (var x = 0; x < 16*map.screens; x++) {
        for(var y = 0; y < 9; y++) {
            var data = map.getData(x, y);
            drawTile(data);

            //ctx.fillStyle = 'rgba(0,0,0,'+((data.depth|0)/40).toFixed(2)+')';
            //ctx.fillRect(x*32,y*32,32,32);
        }
    }
}

module.exports = main;