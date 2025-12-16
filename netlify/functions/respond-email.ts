import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const { projectId, clientEmail, clientName, projectName, totalPrice, clientMessage } = JSON.parse(event.body || '{}');

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'IA no configurada' }) };
    }

    const prompt = `Eres un profesional de construcción en Barcelona respondiendo a una objeción de precio.

CONTEXTO:
- Cliente: ${clientName}
- Proyecto: ${projectName}
- Presupuesto: ${totalPrice}€
- Mensaje del cliente: "${clientMessage}"

GENERA una respuesta profesional, convincente y persuasiva que:
1. Muestra empatía
2. Explica el valor real del precio
3. Justifica con calidad, experiencia, garantías
4. Compara con competencia barata (sin calidad)
5. Ofrece diálogo (ajustar alcance si necesario)
6. Mantiene tono cercano pero profesional

Responde SOLO el texto del email, sin formato JSON, sin título, directo para copiar y pegar.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'Error generando respuesta';

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (gmailUser && gmailPass) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: `"Presupuestos" <${gmailUser}>`,
        to: clientEmail,
        subject: `Re: Presupuesto - ${projectName}`,
        text: aiResponse,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, response: aiResponse, emailSent: true }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
