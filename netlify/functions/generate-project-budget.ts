import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

/* ────────────────────────────────────────────── */
/* SUPABASE ADMIN CLIENT                          */
/* ────────────────────────────────────────────── */
const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/* ────────────────────────────────────────────── */
/* TYPES                                          */
/* ────────────────────────────────────────────── */
interface BudgetItem {
  serviceId: string;
  quantity: number;
  difficultyFactor: number;
  customNotes?: string;
}

interface ProjectRequest {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  projectName: string;
  distanceKm: number;
  observations?: string;
  priceAdjustment?: number;
  items: BudgetItem[];
}

/* ────────────────────────────────────────────── */
/* HANDLER                                        */
/* ────────────────────────────────────────────── */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' }),
    };
  }

  try {
    const data: ProjectRequest = JSON.parse(event.body || '{}');

    /* ────────────────────────────────────────── */
    /* CLIENTE                                    */
    /* ────────────────────────────────────────── */
    const existingClient = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('email', data.clientEmail)
      .maybeSingle();

    let clientId: string;

    if (!existingClient.data) {
      const newClient = await supabaseAdmin
        .from('clients')
        .insert({
          name: data.clientName,
          email: data.clientEmail,
          phone: data.clientPhone || '',
        })
        .select()
        .single();

      clientId = newClient.data!.id;
    } else {
      clientId = existingClient.data.id;
    }

    /* ────────────────────────────────────────── */
    /* SERVICIOS                                  */
    /* ────────────────────────────────────────── */
    let totalGeneral = 0;
    const itemsDetails: any[] = [];

    for (const item of data.items) {
      const service = await supabaseAdmin
        .from('services')
        .select('*')
        .eq('id', item.serviceId)
        .single();

      if (!service.data) continue;

      const basePrice = Number(service.data.base_price);
      const quantity = Number(item.quantity);
      const difficulty = Number(item.difficultyFactor);

      const itemTotal = basePrice * quantity * difficulty;
      totalGeneral += itemTotal;

      itemsDetails.push({
        service: service.data,
        quantity,
        difficulty,
        itemTotal,
        notes: item.customNotes || '',
      });
    }

    /* ────────────────────────────────────────── */
    /* DESPLAZAMIENTO                             */
    /* ────────────────────────────────────────── */
    const distanceFee =
      data.distanceKm > 15 ? (data.distanceKm - 15) * 3 : 0;

    /* ────────────────────────────────────────── */
    /* PROJECT DATA                               */
    /* ────────────────────────────────────────── */
    const projectData = {
      client_id: clientId,
      project_name: data.projectName,
      distance_km: data.distanceKm,
      global_difficulty: 1.0,
      observations: data.observations || '',
      total_price: (
        totalGeneral +
        distanceFee +
        (data.priceAdjustment || 0)
      ).toFixed(2),
      status: 'pending',
    };

    /* ────────────────────────────────────────── */
    /* CREAR PROYECTO                             */
    /* ────────────────────────────────────────── */
    const project = await supabaseAdmin
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    /* ────────────────────────────────────────── */
    /* ITEMS DEL PRESUPUESTO                      */
    /* ────────────────────────────────────────── */
    for (let i = 0; i < data.items.length; i++) {
      await supabaseAdmin.from('budget_items').insert({
        project_id: project.data!.id,
        service_id: data.items[i].serviceId,
        quantity: data.items[i].quantity,
        custom_notes: data.items[i].customNotes || '',
        subtotal: itemsDetails[i].itemTotal,
      });
    }

    /* ────────────────────────────────────────── */
    /* EMAIL                                      */
    /* ────────────────────────────────────────── */
    const emailContent = generateConsolidatedEmail(
      data.clientName,
      data.projectName,
      itemsDetails,
      data.distanceKm,
      distanceFee,
      Number(projectData.total_price),
      data.observations || ''
    );

    await supabaseAdmin.from('email_history').insert({
      budget_id: project.data!.id,
      type: 'proposal',
      content: emailContent,
    });

    const emailSent = await sendEmail(
      data.clientEmail,
      data.clientName,
      data.projectName,
      emailContent
    );

    if (emailSent) {
      await supabaseAdmin
        .from('projects')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', project.data!.id);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        projectId: project.data!.id,
        totalPrice: projectData.total_price,
        emailSent,
      }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

/* ────────────────────────────────────────────── */
/* EMAIL TEMPLATE                                 */
/* ────────────────────────────────────────────── */
function generateConsolidatedEmail(
  clientName: string,
  projectName: string,
  items: any[],
  distanceKm: number,
  distanceFee: number,
  totalPrice: number,
  observations: string
): string {
  let itemsList = '';

  items.forEach((item, idx) => {
    itemsList += `${idx + 1}. ${item.service.name}\n`;
    itemsList += `   ${item.quantity} ${item.service.unit} × ${item.service.base_price}€`;

    if (item.difficulty > 1) {
      itemsList += ` × ${item.difficulty} = ${item.itemTotal.toFixed(2)}€\n`;
    } else {
      itemsList += ` = ${item.itemTotal.toFixed(2)}€\n`;
    }

    if (item.notes) itemsList += `   ${item.notes}\n`;
    itemsList += '\n';
  });

  return `
Estimado/a ${clientName},

Tras la visita técnica realizada, le presentamos el presupuesto detallado para su obra.

═══════════════════════════════════════════════════════════
PRESUPUESTO: ${projectName.toUpperCase()}
═══════════════════════════════════════════════════════════

SERVICIOS INCLUIDOS
───────────────────────────────────────────────────────────

${itemsList}
${
  distanceFee > 0
    ? `Gastos de desplazamiento (${distanceKm} km):        ${distanceFee.toFixed(
        2
      )}€\n`
    : ''
}
═══════════════════════════════════════════════════════════
IMPORTE TOTAL:                             ${totalPrice.toFixed(2)}€
═══════════════════════════════════════════════════════════

${observations ? `OBSERVACIONES:\n${observations}\n\n` : ''}
✓ Presupuesto elaborado tras visita técnica
✓ Materiales de primera calidad incluidos
✓ Garantía de todos los trabajos realizados
✓ Validez del presupuesto: 15 días

Quedamos a su entera disposición para cualquier consulta.

Un cordial saludo.
`.trim();
}

/* ────────────────────────────────────────────── */
/* SEND EMAIL (GMAIL / NODEMAILER)                 */
/* ────────────────────────────────────────────── */
async function sendEmail(
  to: string,
  name: string,
  project: string,
  content: string
): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn('Gmail não configurado');
    return false;
  }

  try {
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    await transporter.sendMail({
      from: `"Presupuestos" <${gmailUser}>`,
      to: to,
      subject: `Presupuesto: ${project} - ${name}`,
      text: content,
    });

    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}
