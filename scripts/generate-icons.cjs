/**
 * Génère les icônes PWA placeholder (icon-192.png et icon-512.png).
 * Utilise uniquement les modules natifs Node.js (zlib).
 * Usage : node scripts/generate-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'assets', 'icons');

// Couleur primaire Dystrax
const BG_COLOR = { r: 99, g: 102, b: 241 }; // #6366f1

/**
 * Crée un buffer PNG minimal valide (carré uni).
 * @param {number} size - largeur/hauteur en pixels
 * @param {{r:number,g:number,b:number}} color
 * @returns {Buffer}
 */
function createPNG(size, color) {
    // Filtre: aucun (byte 0 pour chaque ligne)
    const rawData = Buffer.alloc(size * (1 + size * 3)); // filtre + RGB par pixel, pour chaque ligne
    for (let y = 0; y < size; y++) {
        const rowOffset = y * (1 + size * 3);
        rawData[rowOffset] = 0; // filtre None
        for (let x = 0; x < size; x++) {
            const pxOffset = rowOffset + 1 + x * 3;
            rawData[pxOffset] = color.r;
            rawData[pxOffset + 1] = color.g;
            rawData[pxOffset + 2] = color.b;
        }
    }

    // Compression DEFLATE
    const compressed = zlib.deflateSync(rawData);

    // Construction du PNG
    const chunks = [];

    // Signature PNG
    chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);  // width
    ihdr.writeUInt32BE(size, 4);  // height
    ihdr[8] = 8;   // bit depth
    ihdr[9] = 2;   // color type: RGB
    ihdr[10] = 0;  // compression
    ihdr[11] = 0;  // filter
    ihdr[12] = 0;  // interlace
    chunks.push(createChunk('IHDR', ihdr));

    // IDAT
    chunks.push(createChunk('IDAT', compressed));

    // IEND
    chunks.push(createChunk('IEND', Buffer.alloc(0)));

    return Buffer.concat(chunks);
}

function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcInput = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcInput), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 (table-driven)
function crc32(buf) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c;
    }
    return table;
})();

// Génération
if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
}

const png192 = createPNG(192, BG_COLOR);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), png192);
console.log('✓ icon-192.png généré');

const png512 = createPNG(512, BG_COLOR);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), png512);
console.log('✓ icon-512.png généré');

console.log('Icônes PWA générées avec succès.');
