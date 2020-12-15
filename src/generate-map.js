"use strict";

const MapArray = require('./map-array');
const lcg = require('./lcg');
const levelsData = require('./levels-data');

const SimplexNoise = require('simplex-noise');

const sprites = {
    help: 0x01,
    hammerBrother: 0x03,
    boomrangBrother: 0x04,
    heavyBrother: 0x05,
    fireBrother: 0x06,
};

const items = {
    mushroom: 0x01,
    flower: 0x02,
    leaf: 0x03,
    frogSuit: 0x04,
    tanookiSuit: 0x05,
    hammerBrotherSuit: 0x06,
    cloud: 0x07,
    wing: 0x08,
    star: 0x09,
    anchor: 0x0A,
    hammer: 0x0B,
    whistle: 0x0C,
    musicBox: 0x0D
};

const musics = {
    world1: {
        id: 0x01,
        animationFrameCount: [0x11, 0x11, 0x11, 0x11]
    },
    world2: {
        id: 0x02,
        animationFrameCount: [0x1F, 0x1F, 0x1F, 0x1F]
    },
    world3: {
        id: 0x03,
        animationFrameCount: [0x17, 0x17, 0x17, 0x17]
    },
    world4: {
        id: 0x04,
        animationFrameCount: [0x17, 0x17, 0x17, 0x17]
    },
    world5: {
        id: 0x05,
        animationFrameCount: [0x11, 0x11, 0x11, 0x11]
    },
    world6: {
        id: 0x06,
        animationFrameCount: [0x0B, 0x0B, 0x0B, 0x0B]
    },
    world7: {
        id: 0x07,
        animationFrameCount: [0x1D, 0x1D, 0x1D, 0x1D]
    },
    world8: {
        id: 0x08,
        animationFrameCount: [0x0F, 0x0F, 0x0F, 0x0F]
    },
    whistle: {
        id: 0x0B,
        animationFrameCount: [0x14, 0x14, 0x14, 0x14]
    }
}

const hammerBrotherItems = [
    items.mushroom,
    items.flower,
    items.leaf,
    items.frogSuit,
    items.tanookiSuit,
    items.hammerBrotherSuit,
    items.cloud,
    items.wing,
    items.star
];

const tiles = {
    start: 'start',
    levelProto: 'levelProto',
    level1: 'level1',
    level2: 'level2',
    level3: 'level3',
    level4: 'level4',
    level5: 'level5',
    level6: 'level6',
    level7: 'level7',
    level8: 'level8',
    level9: 'level9',
    level10: 'level10',
    roadProto: 'roadProto',
    roadProtoWithCoin: 'roadProtoWithCoin',
    roadCross: 'roadCross',
    roadCrossWithCoin: 'roadCrossWithCoin',
    roadVert: 'roadVert',
    roadVertOverRiver: 'roadVertOverRiver',
    roadVertWithCoin: 'roadVertWithCoin',
    roadHoriz: 'roadHoriz',
    roadHorizOverRiver: 'roadHorizOverRiver',
    roadHorizNotWalkable: 'roadHorizNotWalkable',
    roadHorizWithCoin: 'roadHorizWithCoin',
    roadWithCoinOnly: 'roadWithCoinOnly',
    island: 'island',
    water: 'water',
    bridge: 'bridge',
    ground: 'ground',
    sand: 'sand',
    palm: 'palm',
    flower: 'flower',
    plant: 'plant',
    pyramid: 'pyramid',
    hill:'hill',
    rock: 'rock',
    fortress: 'fortress',
    tower: 'tower',
    castle: 'castle',
    castleTop: 'castleTop',
    black: 'black',
    spade: 'spade',
    toadHouseProto: 'toadHouseProto',
    toadHouse: 'toadHouse',
    toadHouseAlt: 'toadHouseAlt',
    skull: 'skull',
    ice: 'ice',
    fire: 'fire',
    pond: 'pond',
    pipe: 'pipe',
    lockVert: 'lockVert',
    lockHoriz: 'lockHoriz',
    rockBreakableHoriz: 'rockBreakableHoriz',
    rockBreakableVert: 'rockBreakableVert'
};

function weightedPick (sortedWeightedChoices, rng, ratioConsidered) {
    const max = sortedWeightedChoices.reduce(function (acc, c) { return acc + c.weight; }, 0);
    let selection = rng() * max * ratioConsidered;

    for (let i = 0; i < sortedWeightedChoices.length; i++) {
        selection = selection - sortedWeightedChoices[i].weight;

        if (selection <= 0) {
            return sortedWeightedChoices[i].data;
        }
    }
}

function removeFromWeightedChoices (weightedChoices, choice) {
    for (let i = weightedChoices.length; i--;) {
        if (weightedChoices[i].data === choice)  {
            weightedChoices.splice(i, 1);
        }
    }
}

function isTileWater (map, x, y, current) {
    if (y > 8) return false;

    const data = map.getData(x, y);
    let tile = data ? data.tile : current;

    if (map.useMargin && (x === 0 || x === 16 * map.screens - 1)) {
        tile = current;
    }

    return [tiles.water, tiles.island, tiles.bridge, tiles.roadHorizOverRiver, tiles.roadVertOverRiver].indexOf(tile) > -1;
}

function binaryMatch (binaryMatrix, choices, defaultValue) {
    for (let key in choices) {
        const effectiveKey = key.replace(/ /g, '');
        let match = 1;

        for (let i = 0; match && i < effectiveKey.length; i++) {
            if (effectiveKey[i] === '0' || effectiveKey[i] === '1') {
                const valueBit = (binaryMatrix >> (effectiveKey.length - i - 1)) & 1;
                const maskBit = effectiveKey[i] | 0;

                match &= maskBit === valueBit;
            }
        }

        if (match) {
            return choices[key];
        }
    }

    return defaultValue;
}

function autoTiling (map) {
    const autoTiling = {
        default: 0xD6, // "red square" tile to highlight issue
        black: 0x02,
        sand: 0x43,
        ground: 0x42,

        rock: 0x53,
        hill: 0xB4,
        palm: 0xBB,
        start: 0xE5,
        pyramid: 0x69,
        roadWithCoinOnly: 0x44,
        roadHoriz: 0x45,
        roadHorizOverRiver: 0xB9,
        bridge: 0xB3,
        roadHorizNotWalkable: 0x49,
        roadVert: 0x46,
        roadVertOverRiver: 0xBA,
        roadHorizWithCoin: 0x47,
        roadVertWithCoin: 0x48,
        roadCrossWithCoin: 0x4A,

        rockBreakableVert: 0x52,
        rockBreakableHoriz: 0x51,
        lockVert: 0x54,
        lockHoriz: 0x56,

        toadHouse: 0x50,
        toadHouseAlt: 0xE0,
        spade: 0xE8,
        tower: 0x5F,
        fortress: 0x67,
        castle: 0xC9,
        castleTop: 0xC8,

        levelProto: 0x40,
        level1: 0x03,
        level2: 0x04,
        level3: 0x05,
        level4: 0x06,
        level5: 0x07,
        level6: 0x08,
        level7: 0x09,
        level8: 0x0A,
        level9: 0x0B,
        level10: 0x0C,

        skull: 0xE2,
        ice: 0xEA,
        fire: 0xD1,
        pond: 0xBF,
        pipe: 0xBC,
        flower: 0xBD,
        plant: 0xBE,
        island: 0xAD,

        water: function (map, x, y) {
            const upLeft = isTileWater(map, x - 1, y - 1, tiles.water);
            const upMiddle = isTileWater(map, x, y - 1, tiles.water);
            const upRight = isTileWater(map, x + 1, y - 1, tiles.water);
            const middleLeft = isTileWater(map, x - 1, y, tiles.water);
            const middleRight = isTileWater(map, x + 1, y, tiles.water);
            const downLeft = isTileWater(map, x - 1, y + 1, tiles.water);
            const downMiddle = isTileWater(map, x, y + 1, tiles.water);
            const downRight = isTileWater(map, x + 1, y + 1, tiles.water);

            const binaryMatrix = (
                (upLeft << 8) | (upMiddle << 7) | (upRight << 6) |
                (middleLeft << 5) | 0 | (middleRight << 3) |
                (downLeft << 2) | (downMiddle << 1) | (downRight << 0)
            );

            // console.log('x', x, 'y', y, 'matrix', '0b'+('000000000' + binaryMatrix.toString(2)).substr(-9));

            const value = binaryMatch(binaryMatrix, {
                'x0x 0c0 x0x': 0xBF, // pond

                'x0x 1c1 x0x': 0xA2, // horizontal river
                'x0x 1c0 x0x': 0xA3, // horizontal river right end
                'x0x 0c1 x0x': 0xA1, // horizontal river left end

                'x1x 0c0 x1x': 0x9D, // vertical river
                'x1x 0c0 x0x': 0x80, // vertical river bottom end (custom tile)
                'x0x 0c0 x1x': 0x81, // vertical river top end (custom tile)

                '010 1c1 x0x': 0x82, // T river to top
                'x0x 1c1 010': 0x83, // T river to bottom
                '01x 1c0 01x': 0x8B, // T river to left
                'x10 0c1 x10': 0x8A, // T river to right

                '01x 1c0 x0x': 0xA7, // river left to top
                'x10 0c1 x0x': 0xA6, // river right to top
                'x0x 1c0 01x': 0x9A, // river left to bottom
                'x0x 0c1 x10': 0x99, // river right to bottom

                '010 1c1 010': 0xA0, // river crossing

                'x0x 1c1 111': 0x85, // top ground
                '111 1c1 x0x': 0x95, // bottom ground
                'x11 0c1 x11': 0x8C, // left ground
                '11x 1c0 11x': 0x8E, // right ground

                'x0x 1c1 110': 0x9B, // top ground + bottom right
                'x0x 1c1 011': 0x9C, // top ground + bottom left
                '110 1c1 x0x': 0xA8, // bottom ground + top right
                '011 1c1 x0x': 0xA9, // botom ground + top left

                'x11 0c1 x10': 0x97, // left ground + bottom right
                'x10 0c1 x11': 0xA4, // left ground + top right
                '11x 1c0 01x': 0x98, // right ground + bottom left
                '01x 1c0 11x': 0xA5, // right ground + top left

                '011 1c1 110': 0x9E, // top left + bottom right
                '110 1c1 011': 0x9F, // top right + bottom left
                '010 1c1 111': 0x91, // top left + top right
                '110 1c1 110': 0x92, // top right + bottom right
                '111 1c1 010': 0x89, // bottom left + bottom right
                '011 1c1 011': 0x93, // top left + bottom left

                '010 1c1 110': 0xAE, // top left + top right + bottom right (custom tile)
                '110 1c1 010': 0xAF, // top right + bottom right + bottom left (custom tile)
                '011 1c1 010': 0xB5, // bottom right + bottom left + top left (custom tile)
                '010 1c1 011': 0xB6, // bottom left + top left + top right (custom tile)

                '011 1c1 111': 0x90, // top left
                '110 1c1 111': 0x8F, // top right
                '111 1c1 011': 0x88, // bottom left
                '111 1c1 110': 0x87, // bottom right

                'x0x 0c1 x11': 0x84, // top left corner
                'x0x 1c0 11x': 0x86, // top right corner
                'x11 0c1 x0x': 0x94, // bottom left corner
                '11x 1c0 x0x': 0x96, // bottom right corner

                '111 1c1 111': 0x8D // no ground
            }, 0x02);

            return value;
        }
    };

    for (let x = 0; x < 16 * map.screens; x++) {
        for(let y = 0; y < 9; y++) {
            const data = map.getData(x, y);
            const tile = data.tile;

            if (autoTiling.hasOwnProperty(tile)) {
                let tileId = 0;

                if (typeof autoTiling[tile] === 'function') {
                    tileId = autoTiling[tile](map, x, y);
                } else {
                    tileId = autoTiling[tile];
                }

                data.tileId = tileId;
            } else {
                data.tileId = autoTiling.default;
            }
        }
    }
}

function applyBiome (map, biome, rng, simplexFunc) {
    const rules = biome.decoRules;
    const dir = [[1,0],[0,1],[0,-1],[-1,0],[2,0],[0,2],[-2,0],[0,-2]];

    for (let r = 0; r < rules.length; r++) {
        const rule = rules[r];
        const ruleTile = rule[0];
        const ruleDist = rule[1];
        const ruleTileCount = rule[2];
        const ruleFunction = rule[3];
        const ruleIterations = rule[4];

        for (let i = 0; i < ruleIterations; i++) {
            const mapClone = map.clone();
            for (let x = 0; x < 16 * map.screens; x++) {
                for(let y = 0; y < 9; y++) {
                    const data = map.getData(x, y);
                    if (data.tile === ruleTile) {
                        let sum = 0;

                        for (let d = 0; d < 4 * ruleDist; d++) {
                            const neighbourData = mapClone.getData(x+dir[d][0], y+dir[d][1]);
                            if (
                                (!neighbourData && ruleTileCount.indexOf(ruleTile) > -1 && dir[d][1] <= 0) ||
                                (neighbourData && ruleTileCount.indexOf(neighbourData.tile) > -1)
                            ) {
                                sum++;
                            }
                        }
                        ruleFunction(data, sum, rng, simplexFunc);
                    }
                }
            }
        }
    }
}

/**
 * 
 * @param {MapArray} seed 
 */
function generateMap (seed) {
    const mainLcg = lcg(seed);
    const pathLcg = lcg(3647 + mainLcg() * 2147480000 | 0);
    const levelsLcg = lcg(3647 + mainLcg() * 2147480000 | 0);
    const decoLcg = lcg(3647 + mainLcg() * 2147480000 | 0);
    const simplex = new SimplexNoise(decoLcg);
    const simplexFunc = function simplexFunc (x, y) {
        return simplex.noise2D(x, y) * 0.5 + 0.5;
    };

    console.log('Seed:', seed);

    const startX = 2;
    const startY = 1 + 2 * (mainLcg() * 4 | 0);
    const screens = 1 + mainLcg() * 2 | 0;

    let useLockAndFort = (screens === 1 && mainLcg() < 0.7);
    let useRockAndHammer = !useLockAndFort && mainLcg() < 0.7;

    const stepsNumber = (screens * (14 + mainLcg() * 9)) | 0;
    const levelsNumber = Math.min(10, (stepsNumber / 3 - 2 + mainLcg() * 3) | 0);
    const branchingChance = 0.1 + 0.075 * screens;
    const directionInertia = (4 - screens) * 0.075;
    const leftToRightTendency = 0.15 + 0.1 * screens;
    let hammerBrotherNumber = Math.min(2, ((screens > 1) + mainLcg() * 3) | 0);
    let hammerBrotherSet = 0;

    const map = new MapArray(screens);
    map.setUseMargin(screens === 1);

    for (let x = 0; x < screens * 16; x++) {
        for (let y = 0; y < 9; y++) {
            if (!map.useMargin || (x > 0 && x < 16 * map.screens - 1)) {
                map.setData(x, y, tiles.ground, null, null, null);
            } else {
                map.setData(x, y, tiles.black, null, null, null);
            }
        }
    }

    map.setData(startX, startY, tiles.start, 0, 0, 0);
    map.setStartData(startX, startY);

    if (pathLcg() > 0.33) {
        map.setData(1, startY, tiles.roadHorizNotWalkable, null, null, null);
        if (!map.useMargin) {
            map.setData(0, startY, tiles.roadHorizNotWalkable, null, null, null);
        }
    }

    const minX = 2;
    const maxX = screens * 16 - 4;

    const wanderingPositions = [[startX, startY, 0, 0, 0]];
    let currentMaxBranch = 0;
    let currentDir = 0;
    const previousWanderingPositions = [[]];

    for (let i = 0; i < stepsNumber;) {
        const currentWanderingIndex = pathLcg() * wanderingPositions.length|0;
        const x = wanderingPositions[currentWanderingIndex][0];
        const y = wanderingPositions[currentWanderingIndex][1];
        const branch = wanderingPositions[currentWanderingIndex][2];
        const dist = wanderingPositions[currentWanderingIndex][3];
        const branchDist = wanderingPositions[currentWanderingIndex][4];

        currentDir = pathLcg() > directionInertia ? (pathLcg() > leftToRightTendency ? pathLcg()*4|0 : 1) : currentDir;

        let dirTests = 0;

        while (true) {
            const xdir = (currentDir % 2) * (currentDir > 1 ? -1 : 1);
            const ydir = ((currentDir + 1) % 2) * (currentDir > 1 ? -1 : 1);

            const nx = x + xdir * 2;
            const ny = y + ydir * 2

            const tileDest = (nx >= minX) && (nx <= maxX) ? map.getData(nx, ny) : null;

            if (tileDest && tileDest.tile === tiles.ground) {
                map.setData(x + xdir, y + ydir, tiles.roadProto, branch, dist + 1, branchDist + 1);
                map.setData(nx, ny, tiles.roadProtoWithCoin, branch, dist + 1, branchDist + 1);
                map.increaseConnectionsNumber(x, y, 1);
                map.increaseConnectionsNumber(x + xdir, y + ydir, 2);
                map.increaseConnectionsNumber(nx, ny, 1);

                if (pathLcg() > branchingChance || branchDist < 2) { // stay on current branch
                    previousWanderingPositions[currentWanderingIndex].push(wanderingPositions[currentWanderingIndex]);
                    wanderingPositions[currentWanderingIndex] = [nx, ny, branch, dist + 1, branchDist + 1];
                } else { // create new branch
                    // currently it doesn't necessarily means that the current branch will be further extended
                    currentMaxBranch++;
                    wanderingPositions.push([nx, ny, currentMaxBranch, dist + 1, 0]);
                    previousWanderingPositions.push([]);
                }

                i++;
                break;
            }

            dirTests++;

            if (dirTests === 4) {
                //we've tested all the possible direction for the current step, fall back on the previous step for this wandering branch
                if (previousWanderingPositions[currentWanderingIndex].length) {
                    wanderingPositions[currentWanderingIndex] = previousWanderingPositions[currentWanderingIndex][previousWanderingPositions[currentWanderingIndex].length - 1];
                    previousWanderingPositions[currentWanderingIndex].length-=1;
                } else {
                    // there is no previous step to fall back on, remove the wandering branch
                    previousWanderingPositions.splice(currentWanderingIndex, 1);
                    wanderingPositions.splice(currentWanderingIndex, 1);
                }

                break;
            }

            currentDir = (4 + currentDir + 1) % 4
        }
    }

    const endOfBranch = [];

    // find the furthest step and replace it with a castle
    let furtherData = map.getData(startX, startY);
    let furtherDataEndOfBranchIndex = 0;
    let tilesToRemove = [];

    for (let x = 0; x < 16*screens; x++) {
        for(let y = 0; y < 9; y++) {
            const data = map.getData(x, y);

            if (data.tile === tiles.roadProtoWithCoin) {
                if(map.getConnectionsNumber(x, y) === 1) {
                    if (data.dist > furtherData.dist) {
                        let tmpFurtherData = data;
                        const tmpTilesToRemove = [];
                        let aboveTile;
                        while ((aboveTile = map.getData(tmpFurtherData.x, tmpFurtherData.y - 1)) && aboveTile.tile !== tiles.ground) {
                            tmpTilesToRemove.push(tmpFurtherData, aboveTile);
                            tmpFurtherData = map.getData(tmpFurtherData.x, tmpFurtherData.y - 2);
                        }

                        if (
                            tmpFurtherData.dist > furtherData.dist ||
                            (tmpFurtherData.dist === furtherData.dist && tmpTilesToRemove.length < tilesToRemove.length)
                        ) {
                            furtherData = tmpFurtherData;
                            tilesToRemove = tmpTilesToRemove;
                            furtherDataEndOfBranchIndex = endOfBranch.length;
                        }
                    }

                    endOfBranch.push(data);
                }
            }
        }
    }

    endOfBranch.splice(furtherDataEndOfBranchIndex, 1);

    //console.log(JSON.stringify(endOfBranch, null, 2));

    const castleX = furtherData.x;
    const castleY = furtherData.y;
    map.setConnectionsNumber(castleX, castleY, 1);
    furtherData.tile = tiles.castle;
    furtherData.pointerSet = levelsData.lastlevel[0].set;
    furtherData.pointerObject = levelsData.lastlevel[0].objectData;
    furtherData.pointerEnemy = levelsData.lastlevel[0].enemyData;

    if (castleY > 0) {
        map.getData(castleX, castleY - 1).tile = tiles.castleTop;
        map.getData(castleX + 1, castleY - 1).sprite = sprites.help;
        map.getData(castleX + 1, castleY - 1).spriteItem = 0x00;
    }

    for (let i = 0; i < tilesToRemove.length; i++) {
        tilesToRemove[i].tile = tiles.ground;
        tilesToRemove[i].branch = null;
        tilesToRemove[i].dist = null;
        tilesToRemove[i].branchDist = null;
        map.setConnectionsNumber(tilesToRemove[i].x, tilesToRemove[i].y, 0);
    }

    const dirs = [[-1,0], [0,1], [0,-1], [1,0]];
    for (let i = 0; i < endOfBranch.length; i++) {
        const data = endOfBranch[i];

        const x = data.x;
        const y = data.y;
        const r1 = pathLcg();
        const r2 = pathLcg();
        const baseDir = pathLcg() * 4 | 0;
        let createdNewPath = false;

        for (let d = 0; d < dirs.length; d++) {
            const dir = dirs[(baseDir + d) % 4];
            const tileDest = map.getData(x + dir[0] * 2, y + dir[1] * 2);
            const tileInter = map.getData(x + dir[0], y + dir[1]);

            if (
                tileInter && tileInter.tile !== tiles.roadProto &&
                tileDest && [tiles.roadProtoWithCoin, tiles.start].indexOf(tileDest.tile) > -1 && Math.abs(tileDest.dist - data.dist) < 9 &&
                (
                    (tileDest.branchDist > 2 && r1 < 0.25) ||
                    (tileDest.branchDist > 3 && r1 < 0.9)
                )
            ) {
                map.increaseConnectionsNumber(x,y,1);
                map.increaseConnectionsNumber(x + dir[0], y + dir[1], 2);
                map.increaseConnectionsNumber(x + dir[0] * 2, y + dir[1] * 2,1);
                map.setData(x + dir[0], y + dir[1], tiles.roadProto, data.branch, data.dist, data.branchDist);
                createdNewPath = true;
            }
        }

        if (!createdNewPath || r1 < 0.2) {
            if (r2 < 0.35) {
                data.tile = tiles.spade;
                data.pointerSet = 'spade';
                data.pointerObject = 0x0010;
                data.pointerEnemy = 0x0011;
            } else {
                data.tile = tiles.toadHouseProto;
                data.pointerSet = 'toadHouse';
                data.pointerObject = 0x24D70;
                data.pointerEnemy = 0x0710;
            }
        }
    }

    //transform

    const connectableTiles = [
        tiles.lockHoriz,
        tiles.lockVert,
        tiles.rockBreakableHoriz,
        tiles.rockBreakableVert,

        tiles.roadProto,
        tiles.roadProtoWithCoin,
        tiles.start,
        tiles.spade,
        tiles.toadHouseProto,
        tiles.toadHouse,
        tiles.toadHouseAlt,
        tiles.castle,
        tiles.level1,
        tiles.level2,
        tiles.level3,
        tiles.level4,
        tiles.level5,
        tiles.level6,
        tiles.level7,
        tiles.level8,
        tiles.level9,
        tiles.level10,
        tiles.tower,
        tiles.fortress,
        tiles.roadCross,
        tiles.roadCrossWithCoin,
        tiles.roadHoriz,
        tiles.roadHorizOverRiver,
        tiles.bridge,
        tiles.roadHorizWithCoin,
        tiles.roadVert,
        tiles.roadVertOverRiver,
        tiles.roadVertWithCoin,
        tiles.roadWithCoinOnly
    ];

    //BFS

    const queue = [
        [castleX, castleY, 0]
    ];
    let queueIndex = 0;

    const directions = [[1,0], [0,-1], [0, 1], [-1, 0]];

    const levelCandidates = [];
    const lockCandidates = [];
    const keyCandidates = [];
    let branchedOut = false;
    const validTilesForLevels = [tiles.roadProtoWithCoin];
    const validTilesForKey = [tiles.roadProtoWithCoin, tiles.toadHouseProto, tiles.spade];
    let minDist = 9999;

    const biomes = [
        {
            key: 'simple',
            mapMusics: [musics.world1, musics.world3, musics.world4, musics.world5, musics.world7, musics.whistle],
            mapPalettes: [0x00, 0x03],
            toadHouseTiles: [tiles.toadHouse, tiles.toadHouseAlt],
            bottomTile: 0x4F, // with ground
            probabilityRoadVertOverRiver: 0.3,
            probabilityRoadHorizOverRiver: 0.0,
            probabilityBridge: 0.8,
            levelFilter: function (lvl) {
                return true;
            },
            decoRules: [
                [tiles.ground, 0, [], function (data, sum, rand, simplex) {
                    if (data.tile === tiles.ground) {
                        const v = simplex(data.x / 13, data.y / 13);

                        if (v > 0.5) {
                            data.tile = tiles.hill;
                        } else if (v < 0.2) {
                            data.tile = tiles.rock;
                        }
                    }
                }, 1],
                [tiles.hill, 2, [tiles.hill], function (data, sum, rand, simplex) {
                    if (sum < 4 && rand() > (sum / 5)**.5) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.ground, 2, [tiles.hill, tiles.rock], function (data, sum, rand, simplex) {
                    if (sum < 3) {
                        data.tile = tiles.water;
                    }
                }, 1],
                [tiles.water, 1, [tiles.ground, tiles.rock, tiles.hill, tiles.roadProtoWithCoin], function (data, sum, rand, simplex) {
                    if (sum > 3) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.water, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum === 0) {
                        data.tile = tiles.hill;
                    }
                }, 1]
            ]
        },
        {
            key: 'ice',
            mapMusics: [musics.world3, musics.world4, musics.world6, musics.world7, musics.world8],
            mapPalettes: [0x05],
            toadHouseTiles: [tiles.toadHouse, tiles.toadHouseAlt],
            bottomTile: 0x4F, // with ground
            probabilityRoadVertOverRiver: 0.3,
            probabilityRoadHorizOverRiver: 0.0,
            probabilityBridge: 1,
            levelFilter: function (lvl) {
                return (lvl.set !== 'desert');
            },
            decoRules: [
                [tiles.ground, 2, [tiles.roadProtoWithCoin, tiles.roadProto], function (data, sum, rand, simplex) {
                    if (sum < 2 && data.y < 8) {
                        const v = simplex(data.x / 15, data.y / 12);

                        if (v > 0.5) {
                            data.tile = tiles.water;
                        }
                    }
                }, 1],
                [tiles.ground, 0, [], function (data, sum, rand, simplex) {
                    if (sum < 2) {
                        const v = simplex(2+data.x / 10, 1+data.y / 10);

                        if (v > 0.55) {
                            data.tile = tiles.ice;
                        } else if (v > 0.45 && simplex(3+data.x / 7, 3+data.y / 7) > 0.4) {
                            data.tile = tiles.hill;
                        } else if (v < 0.25 && rand() < 0.3) {
                            data.tile = tiles.ice;
                        }
                    }
                }, 1],
                [tiles.ground, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum > 0) {
                        data.tile = tiles.water;
                    }
                }, 2],
                [tiles.ground, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum > 2) {
                        data.tile = tiles.water;
                    }
                }, 2],
                [tiles.water, 1, [tiles.water, tiles.black], function (data, sum, rand, simplex) {
                    if (sum < 2) {
                        data.tile = tiles.ice;
                    }
                }, 1],
            ]
        },
        {
            key: 'desert',
            mapMusics: [musics.world2, musics.world4, musics.world5, musics.world7],
            mapPalettes: [0x01, 0x01, 0x01, 0x00, 0x03],
            toadHouseTiles: [tiles.toadHouse, tiles.toadHouseAlt],
            bottomTile: 0x4F, // with ground
            probabilityRoadVertOverRiver: 0,
            probabilityRoadHorizOverRiver: 0,
            probabilityBridge: 0.2,
            levelFilter: function (lvl) {
                return (lvl.set !== 'ice' && lvl.set !== 'water');
            },
            decoRules: [
                [tiles.ground, 1, [tiles.ground, tiles.black], function (data, sum, rand, simplex) {
                    const v1 = simplex(data.x/9, data.y/11);
                    const v2 = simplex(5 + data.x/6, 6 + data.y/6) * simplex(9+data.x/7,data.y/6);

                    if (v1 > 0.8) {
                        data.tile = tiles.rock;
                    } else if (v2 > 0.45) {
                        data.tile = tiles.palm;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.ground, tiles.black], function (data, sum, rand, simplex) {
                    //place oasis (on x%2 only as they are marchable on)
                    if (sum === 0) {
                        if (rand() < 0.4) {
                            data.tile = tiles.pond;
                        } else {
                            data.tile = tiles.palm;
                        }
                    }
                }, 1],
                [tiles.rock, 1, [tiles.pond, tiles.water], function (data, sum, rand, simplex) {
                    // replace rocks adjacent to an oasis by palm tree
                    if (sum > 0) {
                        data.tile = tiles.palm;
                    }
                }, 1],
                [tiles.ground, 2, [tiles.palm, tiles.rock, tiles.roadProto, tiles.roadProtoWithCoin, tiles.levelProto, tiles.castle], function (data, sum, rand, simplex) {
                    if (sum < 1 && ((1+startY%2+data.x^data.y)%2) && Math.max(simplex(8+data.x/9,9+data.y/9), simplex(data.x/8,9+data.y/7)) < 0.5) {
                        data.tile = tiles.pyramid;
                    } else {
                        data.tile = tiles.sand;
                    }
                }, 1],
                [tiles.sand, 2, [tiles.start, tiles.palm, tiles.rock, tiles.roadProto, tiles.roadProtoWithCoin, tiles.levelProto, tiles.castle, tiles.pyramid], function (data, sum, rand, simplex) {
                    if (sum === 0 && data.x > 3 && data.y > 2 && data.y < 6) {
                        data.tile = tiles.water;
                    }
                }, 1],
                [tiles.sand, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (rand() < sum * 0.1) {
                        data.tile = tiles.water;
                    }
                }, 8],
                [tiles.water, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum < 2) {
                        data.tile = tiles.sand;
                    }
                }, 4],
            ]
        },
        {
            key: 'dark-lava',
            mapMusics: [musics.world2, musics.world5, musics.world6, musics.world7, musics.world8],
            mapPalettes: [0x07], //0x07
            toadHouseTiles: [tiles.toadHouse], // alt toad house doesn't look too good with palette 7
            bottomTile: 0x4F, // with ground
            probabilityRoadVertOverRiver: 1,
            probabilityRoadHorizOverRiver: 0.9,
            probabilityBridge: 0.1,
            levelFilter: function (lvl) {
                return (lvl.set !== 'ice' && lvl.set !== 'water' && lvl.set !== 'sky' && lvl.set !== 'clouds');
            },
            decoRules: [
                [tiles.ground, 1, [tiles.ground, tiles.black], function (data, sum, rand, simplex) {
                    if (sum < 3 && data.y < 8 && simplex(data.x/8, data.y/9) > 0.6) {
                        data.tile = tiles.water;
                    }
                }, 3],
                [tiles.water, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum === 0) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum > 0 && data.y < 8 && rand() < 0.5) {
                        data.tile = tiles.water;
                    }
                }, 6],
                [tiles.water, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum < 2) {
                        data.tile = tiles.ground;
                    }
                }, 20],
                [tiles.ground, 1, [tiles.ground, tiles.black], function (data, sum, rand, simplex) {
                    if (sum > 3) {
                        data.tile = tiles.skull;
                    }
                }, 1],
                [tiles.black, 1, [tiles.ground], function (data, sum, rand, simplex) {
                    if (sum > 1 && rand() > 0.75) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.ground, 2, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum > 4) {
                        data.tile = tiles.fire;
                    } else if (sum > 3) {
                        data.tile = tiles.skull;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.ground], function (data, sum, rand, simplex) {
                    if (data.y === 0 || data.y === 8 || data.x < 2) {
                        data.tile = tiles.skull;
                    }
                }, 1],
                [tiles.ground, 2, [tiles.skull, tiles.roadProtoWithCoin], function (data, sum, rand, simplex) {
                    if ((sum === 0 && rand() < 0.1) || (sum < 3 && rand() < 0.05)) {
                        data.tile = tiles.flower;
                    }
                }, 1],
                [tiles.flower, 1, [tiles.flower], function (data, sum, rand, simplex) {
                    if (sum > 0) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.water], function (data, sum, rand, simplex) {
                    if (sum === 1) {
                        data.tile = tiles.pond;
                    }
                }, 1],
                [tiles.pond, 1, [tiles.pond], function (data, sum, rand, simplex) {
                    if (sum === 0) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.skull], function (data, sum, rand, simplex) {
                    if (sum > 1 && rand() < 0.2) {
                        data.tile = tiles.flower;
                    }
                }, 1],
            ]
        },
        {
            key: 'water',
            mapMusics: [musics.world2, musics.world5, musics.world6, musics.world7, musics.world8],
            mapPalettes: [0x03, 0x06, 0x06, 0x06, 0x07],
            toadHouseTiles: [tiles.toadHouse, tiles.toadHouseAlt],
            bottomTile: 0x4E, // with ground
            probabilityRoadVertOverRiver: 1,
            probabilityRoadHorizOverRiver: 0.5,
            probabilityBridge: 0.5,
            levelFilter: function (lvl) {
                return lvl.set !== 'desert';
            },
            decoRules: [
                [tiles.ground, 0, [], function (data, sum, rand, simplex) {
                    data.tile = tiles.water;
                }, 1],
                [tiles.water, 2, [tiles.ground, tiles.roadProtoWithCoin, tiles.roadProto], function (data, sum, rand, simplex) {
                    if (sum > 2 && rand() < 0.8 && data.y !== 4 && data.x !== 7 + (data.y > 4 ? 2 : 0)) {
                        data.tile = tiles.ground;
                    }
                }, 3],
                [tiles.water, 1, [tiles.water, tiles.roadProto], function (data, sum, rand, simplex) {
                    if (sum === 0) {
                        data.tile = tiles.ground;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.castle], function (data, sum, rand, simplex) {
                    if (sum > 0) {
                        data.tile = tiles.water;
                    }
                }, 1],
                [tiles.ground, 1, [tiles.ground], function (data, sum, rand, simplex) {
                    if (sum > 0) {
                        data.tile = tiles.plant;
                    } else {
                        data.tile = tiles.flower;
                    }
                }, 1],
                [tiles.plant, 1, [tiles.plant, tiles.water, tiles.flower], function (data, sum, rand, simplex) {
                    if (sum === 4 && rand() < 0.2) {
                        data.tile = tiles.pipe;
                    }
                }, 1],
            ]
        }
    ];

    const selectedBiome = biomes[biomes.length * mainLcg() | 0];
    const selectedMusic = selectedBiome.mapMusics[selectedBiome.mapMusics.length * mainLcg() | 0];
    const selectedPalette = selectedBiome.mapPalettes[selectedBiome.mapPalettes.length * mainLcg() | 0];
    const selectedToadHouseTile = selectedBiome.toadHouseTiles[selectedBiome.toadHouseTiles.length * mainLcg() | 0];

    map.setBottomBorderTile(selectedBiome.bottomTile);
    map.setMusic(selectedMusic.id);
    map.setAnimationFrameCount(
        selectedMusic.animationFrameCount[0],
        selectedMusic.animationFrameCount[1],
        selectedMusic.animationFrameCount[2],
        selectedMusic.animationFrameCount[3]
    );
    map.setMapPalette(selectedPalette);

    const levelCandidatesWeakMap = new WeakMap();

    window.mapArray = map;

    while(queue.length > queueIndex) {
        const x = queue[queueIndex][0];
        const y = queue[queueIndex][1];
        const depth = queue[queueIndex][2];

        const currentData = map.getData(x, y);
        const currentConnections = map.getConnectionsNumber(x, y);
        let onCriticalPath = false;

        if (minDist > currentData.dist) {
            onCriticalPath = true;
            minDist = currentData.dist;
        }

        if (validTilesForLevels.indexOf(currentData.tile) > -1) {
            let weight = (
                Math.pow(levelsLcg(), 2) * 2 +
                (onCriticalPath ? 1 : 0) +
                (currentConnections < 2 ? 1 : 0) +
                (currentConnections > 2 ? 2 : 0)
            );

            if (depth < 2) {
                weight = 0;
            }

            const candidate = {
                weight: Math.max(0, weight),
                data: currentData
            };

            levelCandidatesWeakMap.set(currentData, candidate);
            levelCandidates.push(candidate);
        }

        if (validTilesForKey.indexOf(currentData.tile) > -1 && branchedOut && depth > 4) {
            const weight = Math.max(0, (
                0.5 + (currentData.dist - 4) * 0.2 +
                (currentConnections < 2 ? 2 + currentData.dist * 0.25 : 0) +
                (currentConnections > 2 ? 0.25 : 0)
            ));

            keyCandidates.push({
                weight: Math.max(0, weight),
                data: currentData
            });
        }

        map.setDepth(x, y, depth);

        const possibleDirs = [];
        for (let i = 0; i < directions.length; i++) {
            const dx = directions[i][0];
            const dy = directions[i][1];
            const data = map.getData(x + dx, y + dy);

            if (data && data.tile === tiles.roadProto && data.depth === null) {
                map.setDepth(x + dx, y + dy, depth);
                queue.push([x + dx * 2, y + dy * 2, depth + 1]);

                if (!branchedOut) {
                    possibleDirs.push(data);
                }
            }
        }

        if (possibleDirs.length > 1) {
            branchedOut = true;
        } else if (possibleDirs.length === 1) {
            lockCandidates.push({
                weight: 0.1 + Math.max(0, 4 - Math.abs(possibleDirs[0].depth - 4)),
                data: possibleDirs[0]
            });
        }

        queueIndex++;
    }

    lockCandidates.sort(function (a, b) { return b.weight - a.weight; });
    keyCandidates.sort(function (a, b) { return b.weight - a.weight; });
    levelCandidates.sort(function (a, b) { return b.weight - a.weight; });

    const hammerBrotherLevels = {
        singlePlatformHills: {
            set: 'hills',
            objectData: 0x213FB,
            enemyData: 0xC73B
        },
        singlePlatformHillsWithBonus: {
            set: 'hills',
            objectData: 0x21415,
            enemyData: 0xC73B
        },
        twoPlatformsPlain: {
            set: 'plain',
            objectData: 0x1F3F7,
            enemyData: 0xC650
        },
        twoPlatformsPlainWithBonus: {
            set: 'plain',
            objectData: 0x1FDE8,
            enemyData: 0xC650
        },
        twoPlatformsInWaterPlain: {
            set: 'plain',
            objectData: 0x1F417,
            enemyData: 0xC650
        },
        twoPlatformsHills: {
            set: 'hills',
            objectData: 0x20CC5,
            enemyData: 0xC650
        },
        twoPlatformsHillsWithBonus: {
            set: 'hills',
            objectData: 0x21432,
            enemyData: 0xC650
        },
        twoPlatformsClouds: {
            set: 'clouds',
            objectData: 0x2799B,
            enemyData: 0xC650
        },
        twoPlatformsCloudsWithBonus: { // contains a glitched 1up
            set: 'clouds',
            objectData: 0x27FC3,
            enemyData: 0xC650
        },
        twoPlatformsIce: {
            set: 'ice',
            objectData: 0x23F20,
            enemyData: 0xC650
        },
        twoPlatformsIceWithBonus: {
            set: 'ice',
            objectData: 0x23F8E,
            enemyData: 0xC650
        },
        twoPlatformsPlain2: {
            set: 'plain',
            objectData: 0x1F438,
            enemyData: 0xC650
        },
        noPlatformGiant: {
            set: 'giant',
            objectData: 0x27F6E,
            enemyData: 0xD0FA
        },
        noPlatformDesert: {
            set: 'desert',
            objectData: 0x29206,
            enemyData: 0xD15D
        },
        noPlatformTwoEnemiesDesert: {
            set: 'desert',
            objectData: 0x29206,
            enemyData: 0xD152
        }
    };

    const hammerBrotherConfigurations = [
        {
            set: 'ice',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.twoPlatformsIce, hammerBrotherLevels.twoPlatformsIceWithBonus]
        },
        {
            set: 'ice',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.twoPlatformsIce, hammerBrotherLevels.twoPlatformsIceWithBonus]
        },

        {
            set: 'desert',
            type: sprites.heavyBrother,
            level: [hammerBrotherLevels.noPlatformDesert]
        },
        {
            set: 'desert',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.noPlatformDesert]
        },
        {
            set: 'desert',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.noPlatformDesert]
        },
        {
            set: 'desert',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.noPlatformTwoEnemiesDesert]
        },
        {
            set: 'desert',
            type: sprites.boomrangBrother,
            level: [hammerBrotherLevels.noPlatformDesert]
        },
        {
            set: 'desert',
            type: sprites.boomrangBrother,
            level: [hammerBrotherLevels.noPlatformTwoEnemiesDesert]
        },

        {
            set: 'giant',
            type: sprites.heavyBrother,
            level: [hammerBrotherLevels.noPlatformGiant]
        },

        {
            set: 'hills',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.singlePlatformHills, hammerBrotherLevels.singlePlatformHillsWithBonus]
        },
        {
            set: 'hills',
            type: sprites.heavyBrother,
            level: [hammerBrotherLevels.singlePlatformHills, hammerBrotherLevels.singlePlatformHillsWithBonus]
        },
        {
            set: 'hills',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.singlePlatformHills, hammerBrotherLevels.singlePlatformHillsWithBonus]
        },

        {
            set: 'hills',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.twoPlatformsHills, hammerBrotherLevels.twoPlatformsHillsWithBonus]
        },
        {
            set: 'hills',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.twoPlatformsHills, hammerBrotherLevels.twoPlatformsHillsWithBonus]
        },

        {
            set: 'plain',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.twoPlatformsPlain, hammerBrotherLevels.twoPlatformsPlain2, hammerBrotherLevels.twoPlatformsPlainWithBonus]
        },
        {
            set: 'plain',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.twoPlatformsPlain, hammerBrotherLevels.twoPlatformsPlain2, hammerBrotherLevels.twoPlatformsPlainWithBonus]
        },

        {
            set: 'clouds',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.twoPlatformsClouds, hammerBrotherLevels.twoPlatformsCloudsWithBonus]
        },
        {
            set: 'clouds',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.twoPlatformsClouds, hammerBrotherLevels.twoPlatformsCloudsWithBonus]
        },

        {
            set: 'water',
            type: sprites.hammerBrother,
            level: [hammerBrotherLevels.twoPlatformsInWaterPlain]
        },
        {
            set: 'water',
            type: sprites.fireBrother,
            level: [hammerBrotherLevels.twoPlatformsInWaterPlain]
        },
    ];

    const possibleHammerBrotherConfigurations = hammerBrotherConfigurations.filter(selectedBiome.levelFilter);
    const hammerBrotherConfiguration = possibleHammerBrotherConfigurations[possibleHammerBrotherConfigurations.length * pathLcg() | 0];

    for (let i = 0; i < levelCandidates.length; i++) {
        const lvlIdx = hammerBrotherConfiguration.level.length * pathLcg() | 0;
        const tile = levelCandidates[i].data;
        tile.pointerSet = hammerBrotherConfiguration.level[lvlIdx].set;
        tile.pointerEnemy = hammerBrotherConfiguration.level[lvlIdx].enemyData;
        tile.pointerObject = hammerBrotherConfiguration.level[lvlIdx].objectData;
    }

    if (keyCandidates.length === 0 || lockCandidates.length === 0) {
        useLockAndFort = useRockAndHammer = false;
    }

    if (useLockAndFort) {
        const lockTile = weightedPick(lockCandidates, pathLcg, 0.4);
        const left = map.getData(lockTile.x - 1, lockTile.y);
        lockTile.tile = left && connectableTiles.indexOf(left.tile) > -1 ? tiles.lockHoriz : tiles.lockVert;
        map.setLockData(lockTile.tile === tiles.lockHoriz, lockTile.x, lockTile.y);

        const fortressTile = weightedPick(keyCandidates, pathLcg, 0.66);
        fortressTile.tile = tiles.fortress;
        removeFromWeightedChoices(levelCandidates, fortressTile);

        const level = levelsData.fortresses[levelsData.fortresses.length * levelsLcg() | 0];
        fortressTile.pointerSet = level.set;
        fortressTile.pointerEnemy = level.enemyData;
        fortressTile.pointerObject = level.objectData;
    } else if (useRockAndHammer) {
        const lockTile = weightedPick(lockCandidates, pathLcg, 0.7);
        const left = map.getData(lockTile.x - 1, lockTile.y);
        lockTile.tile = left && connectableTiles.indexOf(left.tile) > -1 ? tiles.rockBreakableHoriz : tiles.rockBreakableVert;

        const hammerBroTile = weightedPick(keyCandidates, pathLcg, 0.66);

        // might overwrite a mushroom house or spade game, so we need to set the pointer
        const lvlIdx = hammerBrotherConfiguration.level.length * pathLcg() | 0;
        hammerBroTile.pointerSet = hammerBrotherConfiguration.level[lvlIdx].set;
        hammerBroTile.pointerEnemy = hammerBrotherConfiguration.level[lvlIdx].enemyData;
        hammerBroTile.pointerObject = hammerBrotherConfiguration.level[lvlIdx].objectData;

        hammerBroTile.sprite = hammerBrotherConfiguration.type;
        hammerBroTile.spriteItem = items.hammer;
        hammerBroTile.tile = tiles.roadProtoWithCoin;
        removeFromWeightedChoices(levelCandidates, hammerBroTile);
        hammerBrotherNumber = Math.max(1, hammerBrotherNumber);
        hammerBrotherSet++;
    }

    while (hammerBrotherSet < hammerBrotherNumber) {
        const hammerBroTile = weightedPick(levelCandidates, pathLcg, 0.7);
        hammerBroTile.sprite = hammerBrotherConfiguration.type;
        hammerBroTile.spriteItem = hammerBrotherItems[hammerBrotherItems.length * levelsLcg() | 0];
        hammerBroTile.tile = tiles.roadProtoWithCoin;
        
        removeFromWeightedChoices(levelCandidates, hammerBroTile);
        
        hammerBrotherSet++;
    }

    const possibleLevels = levelsData.levels.filter(selectedBiome.levelFilter);

    const selectedLevelTiles = [];

    function updateAdjacentWeights (map, levelTile, levelCandidatesWeakMap) {
        // TODO using a better data structure would make a lot of this unnecessary, one day maybe
        const directions = [[1,0], [0,-1], [0, 1], [-1, 0]];

        for (let i = 0; i < directions.length; i++) {
            const x = levelTile.x + directions[i][0];
            const y = levelTile.y + directions[i][1];

            if (map.getData(x, y).tile === tiles.roadProto) {
                const x2 = levelTile.x + directions[i][0] * 2;
                const y2 = levelTile.y + directions[i][1] * 2;
                const candidateTile = map.getData(x2, y2);
                const levelCandidate = levelCandidatesWeakMap.get(candidateTile);

                if (levelCandidate) {
                    levelCandidate.weight = levelCandidate.weight * 0.01;
                }
            }
        }
    }

    for (let i = 0; i < levelsNumber; i++) {
        const levelTile = weightedPick(levelCandidates, pathLcg, 1);
        selectedLevelTiles.push(levelTile);
        removeFromWeightedChoices(levelCandidates, levelTile);
        updateAdjacentWeights(map, levelTile, levelCandidatesWeakMap);
    }


    selectedLevelTiles.sort(function (a, b) {
        return (a.dist - b.dist) + (b.depth - a.depth) / 3;
    });

    let currentLevelIdx = 0;
    for (let i = 0; i < selectedLevelTiles.length; i++) {
        const maxLevel = (possibleLevels.length - 1) * (i + 1) / selectedLevelTiles.length;
        currentLevelIdx += 1 + levelsLcg() * (maxLevel - currentLevelIdx - 1) | 0;
        const level = possibleLevels[currentLevelIdx];

        selectedLevelTiles[i].tile = tiles['level' + (i + 1)];
        selectedLevelTiles[i].pointerSet = level.set;
        selectedLevelTiles[i].pointerEnemy = level.enemyData;
        selectedLevelTiles[i].pointerObject = level.objectData;
    }

    applyBiome(map, selectedBiome, decoLcg, simplexFunc);

    // autotiling of the path tiles
    for (let x = 0; x < 16 * map.screens; x++) {
        for(let y = 0; y < 9; y++) {
            const data = map.getData(x, y);
            const r = pathLcg();

            if (data) {
                if (data.tile === tiles.roadProto) {
                    const left = map.getData(x - 1, y);
                    const right = map.getData(x + 1, y);

                    if (
                        left && connectableTiles.indexOf(left.tile) > -1 &&
                        right && connectableTiles.indexOf(right.tile) > -1
                    ) {
                        const surroundedByWater = isTileWater(map, x, y + 1, tiles.ground) && isTileWater(map, x, y - 1, tiles.ground);
                        
                        if (surroundedByWater && r < selectedBiome.probabilityRoadHorizOverRiver) {
                            data.tile = tiles.roadHorizOverRiver;
                        } else if (surroundedByWater && r - selectedBiome.probabilityRoadHorizOverRiver < selectedBiome.probabilityBridge) {
                            data.tile = tiles.bridge;
                        } else {
                            data.tile = tiles.roadHoriz;
                        }
                        continue;
                    }

                    const up = map.getData(x, y - 1);
                    const down = map.getData(x, y + 1);

                    if (
                        up && connectableTiles.indexOf(up.tile) > -1 &&
                        down && connectableTiles.indexOf(down.tile) > -1
                    ) {
                        const surroundedByWater = isTileWater(map, x + 1, y, tiles.ground) && isTileWater(map, x - 1, y, tiles.ground);
                        if (surroundedByWater && r < selectedBiome.probabilityRoadVertOverRiver) {
                            data.tile = tiles.roadVertOverRiver;
                        } else {
                            data.tile = tiles.roadVert;
                        }
                        continue;
                    }
                } else if (data.tile === tiles.roadProtoWithCoin) {
                    const left = map.getData(x - 1, y);
                    const up = map.getData(x, y - 1);

                    if (
                        left && connectableTiles.indexOf(left.tile) > -1 &&
                        up && connectableTiles.indexOf(up.tile) > -1
                    ) {
                        data.tile = tiles.roadCrossWithCoin;
                    } else if (
                        up && connectableTiles.indexOf(up.tile) > -1
                    ) {
                        data.tile = tiles.roadVertWithCoin;
                    } else if (
                        left && connectableTiles.indexOf(left.tile) > -1
                    ) {
                        data.tile = tiles.roadHorizWithCoin;
                    } else {
                        data.tile = tiles.roadWithCoinOnly;
                    }
                } else if (data.tile === tiles.toadHouseProto) {
                    data.tile = selectedToadHouseTile;
                }
            }
        }
    }

    autoTiling(map);
    return map;
}

module.exports = generateMap;