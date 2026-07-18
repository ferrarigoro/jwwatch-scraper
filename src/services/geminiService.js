// src/services/geminiService.js
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
require('dotenv').config();

// Inicializamos el SDK con tu clave
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 1. DEFINIMOS EL CONTRATO DE DATOS PARA LA IA
const questionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        id: { type: SchemaType.STRING, description: "ID único de la pregunta, ej: 20260713-SUM-NRM-01" },
        source: { type: SchemaType.STRING, description: "Solo puede ser MIDWEEK o WATCHTOWER" },
        type: { type: SchemaType.STRING, description: "Solo puede ser MULTIPLE_CHOICE o TRUE_FALSE" },
        difficulty: { type: SchemaType.STRING, description: "Solo puede ser EASY, NORMAL o HARD" },
        question: { type: SchemaType.STRING, description: "El texto de la pregunta" },
        options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: "ATENCIÓN: Para MULTIPLE_CHOICE deben ser 3 elementos, para TRUE_FALSE deben ser 2. EL ÍNDICE 0 SIEMPRE DEBE SER LA RESPUESTA CORRECTA."
        },
        explanation: { type: SchemaType.STRING, description: "Explicación breve de por qué el índice 0 es correcto." }
    },
    required: ["id", "source", "type", "difficulty", "question", "options", "explanation"]
};

const quizSchema = {
    type: SchemaType.OBJECT,
    properties: {
        quizId: { type: SchemaType.STRING },
        questions: {
            type: SchemaType.ARRAY,
            items: questionSchema
        }
    },
    required: ["quizId", "questions"]
};

const finalOutputSchema = {
    type: SchemaType.OBJECT,
    properties: {
        weekId: { type: SchemaType.INTEGER },
        normalQuiz: quizSchema,
        hardQuiz: quizSchema
    },
    required: ["weekId", "normalQuiz", "hardQuiz"]
};

// 2. CONFIGURAMOS EL MODELO Y EL PROMPT ESTRICTO
async function generateQuizzes(weekId, midweekText, watchtowerText) {
    if (!process.env.GEMINI_API_KEY) {
        console.error("No se encontró GEMINI_API_KEY. Saltando IA.");
        return null;
    }

    // Definimos nuestra cascada de modelos (del mejor al más estable)
    const fallbackModels = ["gemini-3.5-flash", "gemini-2.5-flash"];
    
    const systemPrompt = `
    Eres un asistente de estudio bíblico para los Testigos de Jehová. Tu tarea es generar evaluaciones de comprensión lectora objetivas basadas EXCLUSIVAMENTE en los textos proporcionados.
    
    REGLAS ESTRICTAS DE CONTEXTO Y TEOLOGÍA:
    - TIENES PROHIBIDO usar conocimiento externo, doctrinas o teología que no esté escrita explícitamente en el texto adjunto.
    - TIENES PROHIBIDO generar preguntas sobre los cánticos o canciones.
    - Si la respuesta a una pregunta no se puede deducir 100% del texto provisto, no la generes.
    
    REGLAS DE ESTRUCTURA:
    1. NO REPETIR NINGUNA PREGUNTA O CONCEPTO entre el cuestionario normal y el difícil.
    2. El ID de la semana es ${weekId}.
    3. 'normalQuiz' (ID '${weekId}-SUM-NRM'): EXACTAMENTE 12 preguntas (2 EASY, 8 NORMAL, 2 TRUE_FALSE).
    4. 'hardQuiz' (ID '${weekId}-SUM-HRD'): EXACTAMENTE 12 preguntas (6 HARD, 4 NORMAL, 2 TRUE_FALSE).
    5. ÍNDICE 0 CORRECTO: La opción en el índice [0] del arreglo 'options' DEBE SER ABSOLUTAMENTE SIEMPRE la respuesta CORRECTA.
    6. TAMAÑO DE OPCIONES: MULTIPLE_CHOICE siempre 3 opciones. TRUE_FALSE siempre 2 opciones.
    7. ORDEN: Primero las preguntas de MIDWEEK, luego las de WATCHTOWER.
    8. FUENTES: En la 'explanation', debes citar de dónde sacaste la respuesta usando las etiquetas [Párrafo X] o [Sección: X] que aparecen en el texto.
    
    TEXTO VIDA Y MINISTERIO (MIDWEEK):
    ${midweekText}
    
    TEXTO LA ATALAYA (WATCHTOWER):
    ${watchtowerText}
    `;

    for (let i = 0; i < fallbackModels.length; i++) {
        const currentModelName = fallbackModels[i];
        try {
            console.log(`Intentando generar quizzes con el modelo: ${currentModelName}...`);
            
            const model = genAI.getGenerativeModel({
                model: currentModelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: finalOutputSchema,
                    temperature: 0.2
                }
            });

            const result = await model.generateContent(systemPrompt);
            const jsonResponse = result.response.text();
            return JSON.parse(jsonResponse);

        } catch (error) {
            if (error.status === 503 || error.status === 429) {
                console.warn(`⚠️ [HTTP ${error.status}] El modelo ${currentModelName} está saturado.`);
                
                // Si aún nos quedan modelos en la lista de respaldo, continuamos al siguiente
                if (i < fallbackModels.length - 1) {
                    console.log(`🔄 Cambiando al modelo de respaldo...`);
                    continue; 
                } else {
                    console.error(`❌ Todos los modelos de respaldo están saturados. Abortando semana ${weekId}.`);
                    return null;
                }
            } else {
                // Si el error es de sintaxis o permisos, abortamos de inmediato
                console.error(`❌ Error crítico en ${currentModelName}:`, error);
                return null;
            }
        }
    }
}

module.exports = { generateQuizzes };