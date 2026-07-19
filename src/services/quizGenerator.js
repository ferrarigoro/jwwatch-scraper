const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Mezcla un arreglo al azar (Algoritmo Fisher-Yates)
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Lee el CSV y lo convierte en un arreglo de objetos de Javascript
function loadQuestionBank(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Solo añadimos la fila si tiene un ID y una pregunta válida
        if (data.id && data.question) {
          results.push(data);
        }
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

/**
 * Selecciona preguntas aleatorias del banco y construye el JSON del Quiz
 */
async function generateQuizPayload(weekId) {
  // Apuntamos a la carpeta donde GitHub Actions descargó tu repositorio privado
  const csvPath = path.join(__dirname, '../../private_data/question_bank.csv');
  
  let bank = [];
  try {
    bank = await loadQuestionBank(csvPath);
  } catch (err) {
    console.error("❌ Error leyendo el CSV del Banco de Preguntas:", err.message);
    return null;
  }

  // 1. Filtrado por dificultad y tipo
  const easyQuestions = shuffleArray(bank.filter(q => q.difficulty === 'EASY' && q.type === 'MULTIPLE_CHOICE'));
  const normalQuestions = shuffleArray(bank.filter(q => q.difficulty === 'NORMAL' && q.type === 'MULTIPLE_CHOICE'));
  const hardQuestions = shuffleArray(bank.filter(q => q.difficulty === 'HARD' && q.type === 'MULTIPLE_CHOICE'));
  const trueFalseQuestions = shuffleArray(bank.filter(q => q.type === 'TRUE_FALSE'));

  // Extrae de forma segura la cantidad solicitada (o menos, si el banco aún es pequeño)
  const getQ = (pool, count) => pool.splice(0, count);

  // 2. Ensamblaje según las reglas estrictas (10 preguntas por Quiz)
  // Normal Quiz: 1 EASY, 7 NORMAL, 2 TRUE_FALSE
  const normalSet = [
    ...getQ(easyQuestions, 1),
    ...getQ(normalQuestions, 7),
    ...getQ(trueFalseQuestions, 2)
  ];

  // Hard Quiz: 6 HARD, 2 NORMAL, 2 TRUE_FALSE
  const hardSet = [
    ...getQ(hardQuestions, 6),
    ...getQ(normalQuestions, 2),
    ...getQ(trueFalseQuestions, 2)
  ];

  // 3. Formateo de los datos para la app de Android
  const formatQuestion = (row, index, prefix) => {
    // Agrupamos las opciones, el índice 0 SIEMPRE es el correcto
    const options = [row.correct_answer];
    if (row.distractor_1) options.push(row.distractor_1);
    if (row.distractor_2) options.push(row.distractor_2);
    if (row.distractor_3) options.push(row.distractor_3);

    return {
      id: `${weekId}-${prefix}-${index.toString().padStart(2, '0')}`,
      category: row.category || "General",
      source: row.source,
      type: row.type,
      difficulty: row.difficulty,
      question: row.question,
      options: options,
      explanation: row.explanation
    };
  };

  // Retornamos el objeto final para ser guardado como JSON
  return {
    weekId: weekId,
    normalQuiz: {
      quizId: `${weekId}-SUM-NRM`,
      questions: shuffleArray(normalSet).map((q, i) => formatQuestion(q, i + 1, "NRM"))
    },
    hardQuiz: {
      quizId: `${weekId}-SUM-HRD`,
      questions: shuffleArray(hardSet).map((q, i) => formatQuestion(q, i + 1, "HRD"))
    }
  };
}

module.exports = { generateQuizPayload };