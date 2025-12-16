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

    const prompt = `Eres un profesional experimentado de construcción en Barcelona respondiendo a una objeción de precio de un cliente.

DATOS REALES:
- Cliente: ${clientName}
- Proyecto: ${projectName}
- Presupuesto presentado: ${totalPrice}€
- Distancia del trabajo: ${distanceKm} km
- Objeción del cliente: "${clientMessage}"

INSTRUCCIONES CRÍTICAS:
1. SÉ FACTUAL: No inventes información técnica específica (herramientas, marcas, garantías legales concretas)
2. USA ARGUMENTOS GENÉRICOS PERO REALES: calidad, experiencia, cumplimiento de plazos, responsabilidad profesional
3. NO uses placeholders como [Tu Nombre], [Tu Empresa], [Contacto]
4. SÉ PERSUASIVO SIN MENTIR: Explica el valor real del precio sin inventar detalles
5. COMPARA con competencia de forma inteligente: "Precios muy bajos suelen significar..." (sin inventar datos)
6. OFRECE FLEXIBILIDAD: Abierto a diálogo para ajustar alcance si es necesario

ESTRUCTURA OBLIGATORIA:
1. Saludo empático y profesional
2. Agradecimiento por la confianza
3. Explicación honesta del valor del precio:
   - Calidad de materiales (sin especificar marcas si no las conoces)
   - Experiencia profesional
   - Seriedad y cumplimiento de plazos
   - Responsabilidad (sin inventar garantías específicas)
4. Comparación inteligente con competencia barata (enfoque en riesgos de precios muy bajos)
5. Apertura al diálogo: "Si deseas ajustar el alcance del proyecto..."
6. Cierre: "Un cordial saludo" (SIN firma, SIN placeholders)

TONO: Profesional, cercano, confiado pero no arrogante, persuasivo sin presionar.

Responde SOLO el texto del email, directo para copiar y enviar al cliente.`;


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
