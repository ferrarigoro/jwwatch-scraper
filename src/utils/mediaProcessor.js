const axios = require('axios');
const sharp = require('sharp');

async function processImageToBase64(urlStr) {
    if (!urlStr) return null;

    try {
        const fullUrl = urlStr.startsWith('http') ? urlStr : `https://wol.jw.org${urlStr}`;
        const response = await axios.get(fullUrl, { responseType: 'arraybuffer' });
        
        // Redimensionamos a 300px de ancho manteniendo proporción y comprimimos a webp
        const buffer = await sharp(response.data)
            .resize({ width: 300, withoutEnlargement: true })
            .webp({ quality: 40 })
            .toBuffer();
        
        return `data:image/webp;base64,${buffer.toString('base64')}`;
    } catch (error) {
        console.error(`Error procesando imagen ${urlStr}:`, error.message);
        return null; // Si falla, devolvemos null para que el reloj intente usar la URL o ignore
    }
}

/**
 * Recorre recursivamente un objeto o arreglo y procesa los bloques de imagen.
 */
async function processMediaInBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) return;
    
    for (let block of blocks) {
        if (block.type === 'image' && block.url) {
            block.base64 = await processImageToBase64(block.url);
        }
    }
}

/**
 * Procesa las imágenes anidadas en los items de Vida y Ministerio
 */
async function processMeetingItemsMedia(items) {
    if (!items || !Array.isArray(items)) return;
    for (let item of items) {
        if (item.images && Array.isArray(item.images)) {
            await processMediaInBlocks(item.images);
        }
    }
}

module.exports = { processMediaInBlocks, processMeetingItemsMedia };