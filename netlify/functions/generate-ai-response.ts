import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { projectName, totalPrice, distanceKm, clientMessage, clientName } = JSON.parse(event.body || '{}');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'IA no configurada' }) };
    }

    const prompt = `Eres un profesional de construcción en Barcelona respondiendo a una objeción de precio.

CONTEXTO REAL:
- Cliente: ${clientName}
- Proyecto: ${projectName}
- Presupuesto: ${totalPrice}€
- Distancia: ${distanceKm} km
- Objeción del cliente: "${clientMessage}"

INSTRUCCIONES CRÍTICAS:
1. NO inventes información que no conoces (herramientas, garantías, técnicas)
2. SÉ FACTUAL: solo habla de lo que está en el contexto
3. Usa argumentos genéricos pero reales (calidad, experiencia, responsabilidad)
4. NO uses placeholders como [Tu Nombre] o [Tu Empresa]
5. Termina con "Un cordial saludo" (sin firma)

ESTRUCTURA:
- Saludo empático
- Explica el valor del precio de forma honesta
- Destaca: calidad de trabajo, experiencia, seriedad profesional
- Compara con competencia (sin detalles inventados)
- Ofrece diálogo para ajustar alcance si es necesario
- Cierre profesional

Responde SOLO el texto del email, directo para copiar y pegar.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        max_tokens: 450,
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'Error generando respuesta';

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response: aiResponse }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
