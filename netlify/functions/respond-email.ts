import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface EmailResponse {
  budgetId: string;
  clientEmail: string;
  clientMessage: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const data: EmailResponse = JSON.parse(event.body || '{}');

    const budget = await supabase
      .from('budgets')
      .select(`
        *,
        clients (*),
        services (*)
      `)
      .eq('id', data.budgetId)
      .single();

    if (!budget.data) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Presupuesto no encontrado' }),
      };
    }

    const responseContent = generateAutoResponse(
      budget.data.clients.name,
      budget.data.services.name,
      parseFloat(budget.data.total_price),
      budget.data.quantity,
      budget.data.distance_km,
      budget.data.difficulty_factor,
      data.clientMessage
    );

    await supabase.from('email_history').insert({
      budget_id: data.budgetId,
      type: 'response',
      content: responseContent,
    });

    const emailSent = await sendEmail(
      data.clientEmail,
      budget.data.clients.name,
      responseContent
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        emailSent,
        response: responseContent,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

function generateAutoResponse(
  clientName: string,
  serviceName: string,
  totalPrice: number,
  quantity: number,
  distanceKm: number,
  difficultyFactor: number,
  clientMessage: string
): string {
  const hasPriceComplaint =
    clientMessage.toLowerCase().includes('caro') ||
    clientMessage.toLowerCase().includes('precio') ||
    clientMessage.toLowerCase().includes('importe') ||
    clientMessage.toLowerCase().includes('coste') ||
    clientMessage.toLowerCase().includes('vale');

  let response = `Hola ${clientName},\n\n¡Gracias por tu respuesta!\n\n`;

  if (hasPriceComplaint) {
    response += `Entiendo tu preocupación sobre el importe. Me gustaría explicarte cómo hemos calculado este presupuesto:\n\n`;

    response += `🔧 TRANSPARENCIA EN EL PRECIO\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    response += `1. CALIDAD DEL SERVICIO\n`;
    response += `   • Profesionales experimentados y cualificados\n`;
    response += `   • Garantía del servicio ejecutado\n`;
    response += `   • Materiales de calidad incluidos en el precio\n\n`;

    response += `2. COSTES OPERATIVOS\n`;
    response += `   • Herramientas y equipos profesionales\n`;
    response += `   • Seguros y responsabilidades\n`;
    response += `   • Impuestos y tasas legales\n\n`;

    if (distanceKm > 15) {
      response += `3. DESPLAZAMIENTO\n`;
      response += `   • La distancia de ${distanceKm}km aumenta los costes de combustible y tiempo\n`;
      response += `   • Garantizamos puntualidad incluso en ubicaciones distantes\n\n`;
    }

    if (difficultyFactor > 1) {
      response += `4. COMPLEJIDAD DEL TRABAJO\n`;
      response += `   • Este servicio requiere cuidados especiales\n`;
      response += `   • Técnicas avanzadas para un mejor resultado\n`;
      response += `   • Tiempo adicional necesario para garantizar la calidad\n\n`;
    }

    response += `💡 ¿POR QUÉ ELEGIR NUESTRO SERVICIO?\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    response += `✓ Experiencia comprobada en el mercado\n`;
    response += `✓ Trabajo bien hecho desde el principio\n`;
    response += `✓ Ahorro a largo plazo (sin rehacer trabajos)\n`;
    response += `✓ Atención personalizada y profesional\n`;
    response += `✓ Plazos cumplidos rigurosamente\n\n`;

    response += `⚠️ ATENCIÓN: Precios muy bajos pueden significar:\n`;
    response += `   • Materiales de baja calidad\n`;
    response += `   • Profesionales sin experiencia\n`;
    response += `   • Trabajo mal hecho que necesitará rehacerse\n`;
    response += `   • Sin garantías ni responsabilidad\n\n`;

    response += `Nuestro objetivo es entregar un trabajo del que no tengas que preocuparte después. `;
    response += `El precio refleja la calidad y seguridad que ofrecemos.\n\n`;

    response += `¡Estamos abiertos al diálogo! Si tienes alguna sugerencia o quieres ajustar el alcance `;
    response += `del proyecto para adecuarlo al presupuesto, estaremos encantados de conversar.\n\n`;
  } else {
    response += `He recibido tu mensaje y estoy a tu disposición para aclarar cualquier duda sobre el presupuesto.\n\n`;
    response += `No dudes en ponerte en contacto si necesitas más información o ajustes en el proyecto.\n\n`;
  }

  response += `¡Quedo a la espera de tu respuesta!\n\n`;
  response += `Atentamente,\n`;
  response += `Equipo de Presupuestos`;

  return response;
}

async function sendEmail(
  to: string,
  name: string,
  content: string
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY no configurada. Email no enviado.');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Presupuestos <presupuestos@example.com>',
        to: [to],
        subject: `Re: Presupuesto para ${name}`,
        text: content,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error al enviar email:', error);
    return false;
  }
}
