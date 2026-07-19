const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { saveJson } = require('../utils/fileSystem');

async function exportQuestionBank() {
  const csvPath = path.join(__dirname, '../../private_data/question_bank.csv');
  
  // Verificamos si el archivo existe (previene errores si el clonado falla)
  if (!fs.existsSync(csvPath)) {
    console.warn("⚠️ No se encontró el archivo CSV en private_data. Saltando exportación del banco.");
    return;
  }

  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        // Solo exportamos filas que tengan contenido válido
        if (data.id && data.question) {
          results.push(data);
        }
      })
      .on('end', async () => {
        // Guardamos todo en un único archivo maestro
        await saveJson('question_bank.json', results);
        console.log(`✅ Banco de preguntas exportado exitosamente (${results.length} preguntas).`);
        resolve();
      })
      .on('error', (err) => {
        console.error("❌ Error leyendo el CSV:", err.message);
        reject(err);
      });
  });
}

module.exports = { exportQuestionBank };