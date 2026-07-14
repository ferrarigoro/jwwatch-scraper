const fs = require('fs').promises;
const path = require('path');

async function saveJson(filename, data) {
    const outputDir = path.join(__dirname, '../../output');
    try {
        // Crea la carpeta output si no existe
        await fs.mkdir(outputDir, { recursive: true });
        const filePath = path.join(outputDir, filename);
        // Guardamos el JSON formateado con 2 espacios de indentación
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`✅ Archivo guardado con éxito: output/${filename}`);
    } catch (error) {
        console.error(`❌ Error guardando ${filename}:`, error);
    }
}

module.exports = { saveJson };