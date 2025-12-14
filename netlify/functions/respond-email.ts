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
      body: JSON.stringify({ error: 'Method not allowed' }),
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
        body: JSON.stringify({ error: 'Budget not found' }),
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
    clientMessage.toLowerCase().includes('preço') ||
    clientMessage.toLowerCase().includes('valor');

  let response = `Olá ${clientName},\n\nAgradecemos seu retorno!\n\n`;

  if (hasPriceComplaint) {
    response += `Entendemos sua preocupação com o valor. Gostaria de explicar como chegamos a esse orçamento:\n\n`;

    response += `🔧 TRANSPARÊNCIA NO PREÇO\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    response += `1. QUALIDADE DO SERVIÇO\n`;
    response += `   • Profissionais experientes e qualificados\n`;
    response += `   • Garantia do serviço executado\n`;
    response += `   • Materiais de qualidade incluídos no preço\n\n`;

    response += `2. CUSTOS OPERACIONAIS\n`;
    response += `   • Ferramentas e equipamentos profissionais\n`;
    response += `   • Seguros e responsabilidades\n`;
    response += `   • Impostos e taxas legais\n\n`;

    if (distanceKm > 10) {
      response += `3. DESLOCAMENTO\n`;
      response += `   • A distância de ${distanceKm}km aumenta custos de combustível e tempo\n`;
      response += `   • Garantimos pontualidade mesmo em locais distantes\n\n`;
    }

    if (difficultyFactor > 1) {
      response += `4. COMPLEXIDADE DO TRABALHO\n`;
      response += `   • Este serviço requer cuidados especiais\n`;
      response += `   • Técnicas avançadas para melhor resultado\n`;
      response += `   • Tempo adicional necessário para qualidade\n\n`;
    }

    response += `💡 POR QUE ESCOLHER NOSSO SERVIÇO?\n`;
    response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    response += `✓ Experiência comprovada no mercado\n`;
    response += `✓ Trabalho feito corretamente desde o início\n`;
    response += `✓ Economia no longo prazo (sem retrabalho)\n`;
    response += `✓ Atendimento personalizado e profissional\n`;
    response += `✓ Prazo cumprido rigorosamente\n\n`;

    response += `⚠️ ATENÇÃO: Preços muito baixos podem significar:\n`;
    response += `   • Materiais de baixa qualidade\n`;
    response += `   • Profissionais sem experiência\n`;
    response += `   • Trabalho mal feito que precisará refazer\n`;
    response += `   • Sem garantias ou responsabilidade\n\n`;

    response += `Nosso objetivo é entregar um trabalho que você não precisará se preocupar depois. `;
    response += `O valor reflete a qualidade e segurança que oferecemos.\n\n`;

    response += `Estamos abertos ao diálogo! Se tiver alguma sugestão ou quiser ajustar o escopo `;
    response += `do projeto para adequar ao orçamento, ficaremos felizes em conversar.\n\n`;
  } else {
    response += `Recebi sua mensagem e estou à disposição para esclarecer qualquer dúvida sobre o orçamento.\n\n`;
    response += `Fique à vontade para entrar em contato se precisar de mais informações ou ajustes no projeto.\n\n`;
  }

  response += `Aguardo seu retorno!\n\n`;
  response += `Atenciosamente,\n`;
  response += `Equipe de Orçamentos`;

  return response;
}

async function sendEmail(
  to: string,
  name: string,
  content: string
): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured. Email not sent.');
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
        from: process.env.EMAIL_FROM || 'Orçamentos <orcamentos@example.com>',
        to: [to],
        subject: `Re: Orçamento para ${name}`,
        text: content,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
