import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface BudgetItem {
  serviceId: string;
  quantity: number;
  difficultyFactor: number;
  includesItems?: string[];
}

interface ProjectRequest {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  projectName: string;
  distanceKm: number;
  clientObservations?: string;
  emailContent?: string;
  items: BudgetItem[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const data: ProjectRequest = JSON.parse(event.body || '{}');

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
        includes: item.includesItems || [],
      });
    }

    const distanceFee = data.distanceKm > 15 ? (data.distanceKm - 15) * 3 : 0;
    totalGeneral += distanceFee;

    const budgetNumberResult = await supabaseAdmin.rpc('nextval', { sequence_name: 'budget_number_seq' });
    const budgetNumber = budgetNumberResult.data || 150;

    const projectData = {
      client_id: clientId,
      project_name: data.projectName,
      distance_km: data.distanceKm,
      global_difficulty: 1.0,
      observations: data.clientObservations || '',
      total_price: totalGeneral.toFixed(2),
      status: 'pending',
      budget_number: budgetNumber,
    };

    const project = await supabaseAdmin.from('projects').insert(projectData).select().single();

    for (let i = 0; i < data.items.length; i++) {
      await supabaseAdmin.from('budget_items').insert({
        project_id: project.data!.id,
        service_id: data.items[i].serviceId,
        quantity: data.items[i].quantity,
        custom_notes: '',
        subtotal: itemsDetails[i].itemTotal,
        includes_items: data.items[i].includesItems || [],
      });
    }

    const pdfBase64 = generatePDF(
      data.clientName,
      data.clientEmail,
      data.clientPhone || '',
      budgetNumber,
      itemsDetails,
      distanceFee,
      data.distanceKm,
      totalGeneral,
      data.clientObservations || ''
    );

    const emailContent = data.emailContent || `Buenas tardes ${data.clientName.split(' ')[0]},\n\nTe envío propuesta de ${data.projectName}.\n\nUn saludo.`;

    await supabaseAdmin.from('email_history').insert({
      budget_id: project.data!.id,
      type: 'proposal',
      content: emailContent,
    });

    const emailSent = await sendEmailWithPDF(
      data.clientEmail,
      data.clientName,
      data.projectName,
      emailContent,
      pdfBase64,
      budgetNumber
    );

    if (emailSent) {
      await supabaseAdmin
        .from('projects')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
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
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

function generatePDF(
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  budgetNumber: number,
  items: any[],
  distanceFee: number,
  distanceKm: number,
  total: number,
  observations: string
): string {
  const doc = new jsPDF();

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getFullYear()).slice(-2)}`;

  doc.setFontSize(9);
  doc.text('Eduardo Bruno Rodríguez González', 14, 15);
  doc.text('Calle Tarragona, 27 08570 Torello', 14, 20);
  doc.text('NIF: 44724261W', 14, 25);
  doc.text('Teléfono: 637 30 69 32', 14, 30);
  doc.text('Mail: eduarbruno27@gmail.com', 14, 35);

  doc.text(clientName, 120, 15);
  doc.text(clientEmail, 120, 20);
  if (clientPhone) doc.text(clientPhone, 120, 25);

  doc.rect(14, 10, 182, 30);

  doc.setFontSize(10);
  doc.text(`Pressupost: ${budgetNumber}/025`, 14, 50);
  doc.text(dateStr, 160, 50);

  doc.rect(14, 45, 182, 7);

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('DESCRIPCIÓN', 14, 60);
  doc.text('TOTAL', 180, 60, { align: 'right' });
  doc.setFont(undefined, 'normal');

  doc.rect(14, 55, 182, 7);

  let yPos = 68;

  items.forEach((item) => {
    const serviceLine = `${item.quantity} ${item.service.name}`;
    doc.text(serviceLine, 14, yPos);
    doc.text(`${item.itemTotal.toFixed(2)} €`, 180, yPos, { align: 'right' });
    yPos += 5;

    if (item.includes && item.includes.length > 0) {
      doc.setFontSize(8);
      item.includes.forEach((inc: string) => {
        if (inc.trim()) {
          const includeText = `Opció: ${inc}`;
          const lines = doc.splitTextToSize(includeText, 160);
          lines.forEach((line: string) => {
            doc.text(line, 14, yPos);
            yPos += 4;
          });
        }
      });
      doc.setFontSize(9);
    }
  });

  if (distanceFee > 0) {
    doc.text(`Desplaçament (${distanceKm} km)`, 14, yPos);
    doc.text(`${distanceFee.toFixed(2)} €`, 180, yPos, { align: 'right' });
    yPos += 5;
  }

  if (observations) {
    yPos += 3;
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(`*${observations}`, 180);
    obsLines.forEach((line: string) => {
      doc.text(line, 14, yPos);
      yPos += 4;
    });
    doc.setFontSize(9);
    yPos += 3;
  }

  yPos += 5;
  doc.text('Mètode de pagament: Transferencia bancaria.', 14, yPos);
  yPos += 5;
  doc.text('Entidad: Banco Santander', 14, yPos);
  yPos += 5;
  doc.text('IBAN: ES19 0049 6783 9726 9504 4312', 14, yPos);

  yPos += 15;
  const subtotal = total;
  const iva = subtotal * 0.21;
  const totalTotal = subtotal + iva;

  doc.setFontSize(10);
  doc.text('SUB-TOTAL', 140, yPos);
  doc.text(`${subtotal.toFixed(2)} €`, 180, yPos, { align: 'right' });
  yPos += 6;
  doc.text('IVA 21%', 140, yPos);
  doc.text(`${iva.toFixed(2)} €`, 180, yPos, { align: 'right' });
  yPos += 6;
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL TOTAL', 140, yPos);
  doc.text(`${totalTotal.toFixed(2)} €`, 180, yPos, { align: 'right' });

  return doc.output('datauristring').split(',')[1];
}

async function sendEmailWithPDF(
  to: string,
  name: string,
  project: string,
  content: string,
  pdfBase64: string,
  budgetNumber: number
): Promise<boolean> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.warn('Gmail no configurado');
    return false;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    await transporter.sendMail({
      from: `"Eduardo Bruno" <${gmailUser}>`,
      to: to,
      subject: `Pressupost ${budgetNumber}/025 - ${project}`,
      text: content,
      attachments: [
        {
          filename: `Pressupost_${budgetNumber}_025.pdf`,
          content: pdfBase64,
          encoding: 'base64',
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}
