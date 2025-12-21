import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface BudgetItem {
  serviceId: string;
  quantity: number;
  difficultyFactor: number;
  includesItems?: string[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
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

      itemsDetails.push({
        service: service.data,
        quantity,
        difficulty,
        itemTotal,
        includes: item.includesItems || [],
      });
    }

    let totalGeneral = 0;
    itemsDetails.forEach(item => totalGeneral += item.itemTotal);
    const distanceFee = data.distanceKm > 15 ? (data.distanceKm - 15) * 3 : 0;
    totalGeneral += distanceFee;

    const pdfDataUrl = await generatePDFPreview(
      data.clientName,
      data.clientEmail,
      data.clientPhone || '',
      data.budgetNumber || 150,
      itemsDetails,
      distanceFee,
      data.distanceKm,
      totalGeneral,
      data.clientObservations || ''
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ pdfDataUrl }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function generatePDFPreview(
  clientName: string,
  clientEmail: string,
  clientPhone: string,
  budgetNumber: number,
  items: any[],
  distanceFee: number,
  distanceKm: number,
  total: number,
  observations: string
): Promise<string> {
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF();

  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getFullYear()).slice(-2)}`;

  doc.setLineWidth(0.8);
  doc.rect(14, 10, 90, 32);
  doc.rect(106, 10, 90, 32);

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Eduardo Bruno Rodríguez González', 16, 16);
  doc.setFont(undefined, 'normal');
  doc.text('Calle Tarragona, 27 08570 Torello', 16, 21);
  doc.setFont(undefined, 'bold');
  doc.text('NIF:', 16, 26);
  doc.setFont(undefined, 'normal');
  doc.text(' 44724261W', 23, 26);
  doc.setFont(undefined, 'bold');
  doc.text('Teléfono:', 16, 31);
  doc.setFont(undefined, 'normal');
  doc.text(' 637 30 69 32', 32, 31);
  doc.setFont(undefined, 'bold');
  doc.text('Mail:', 16, 36);
  doc.setFont(undefined, 'normal');
  doc.text(' eduarbruno27@gmail.com', 25, 36);

  doc.setFont(undefined, 'bold');
  doc.text(clientName, 108, 16);
  doc.setFont(undefined, 'normal');
  doc.setFont(undefined, 'bold');
  doc.text('Mail:', 108, 21);
  doc.setFont(undefined, 'normal');
  doc.text(` ${clientEmail}`, 117, 21);
  if (clientPhone) {
    doc.setFont(undefined, 'bold');
    doc.text('Teléfono:', 108, 26);
    doc.setFont(undefined, 'normal');
    doc.text(` ${clientPhone}`, 124, 26);
  }

  doc.setLineWidth(0.8);
  doc.rect(14, 45, 182, 8);

  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.text(`Pressupost: ${budgetNumber}/025`, 16, 50);
  doc.setFont(undefined, 'normal');
  doc.text(dateStr, 175, 50);

  doc.setLineWidth(0.8);
  doc.rect(14, 56, 140, 7);
  doc.rect(154, 56, 42, 7);

  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('DESCRIPCIÓN', 16, 61);
  doc.text('TOTAL', 180, 61, { align: 'right' });
  doc.setFont(undefined, 'normal');

  let yPos = 68;

  items.forEach((item) => {
    const serviceLine = `${item.quantity} ${item.service.unit} ${item.service.name}`;
    doc.text(serviceLine, 16, yPos);
    doc.text(`${item.itemTotal.toFixed(2)} €`, 189, yPos, { align: 'right' });
    yPos += 5;

    if (item.includes && item.includes.length > 0) {
      doc.setFontSize(8);
      item.includes.forEach((inc: string) => {
        if (inc.trim()) {
          const lines = doc.splitTextToSize(inc, 170);
          lines.forEach((line: string) => {
            doc.text(line, 16, yPos);
            yPos += 4;
          });
        }
      });
      doc.setFontSize(9);
    }
  });

  if (distanceFee > 0) {
    doc.text(`Desplaçament (${distanceKm} km)`, 16, yPos);
    doc.text(`${distanceFee.toFixed(2)} €`, 189, yPos, { align: 'right' });
    yPos += 5;
  }

  if (observations) {
    yPos += 3;
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(`*${observations}`, 180);
    obsLines.forEach((line: string) => {
      doc.text(line, 16, yPos);
      yPos += 4;
    });
    doc.setFontSize(9);
    yPos += 3;
  }

  yPos += 2;
  doc.setFontSize(8);
  doc.text('*Termini d\'entrega previst, segona - tercera setmana de gener.', 16, yPos);
  yPos += 4;
  doc.text('*Treballs complementaris no inclosos (Electricista, pintor...)', 16, yPos);
  yPos += 6;
  doc.setFontSize(9);

  doc.text('Mètode de pagament: Transferencia bancaria.', 16, yPos);
  yPos += 5;
  doc.text('Entidad: Banco Santander', 16, yPos);
  yPos += 5;
  doc.text('IBAN: ES19 0049 6783 9726 9504 4312', 16, yPos);

  yPos += 12;
  const subtotal = total;
  const iva = subtotal * 0.21;
  const totalTotal = subtotal + iva;

  doc.setFillColor(173, 216, 230);
  doc.rect(14, yPos - 5, 182, 6, 'F');
  doc.setLineWidth(0.8);
  doc.rect(14, yPos - 5, 140, 6);
  doc.rect(154, yPos - 5, 42, 6);

  doc.setFontSize(10);
  doc.setTextColor(0, 102, 204);
  doc.setFont(undefined, 'bold');
  doc.text('SUB-TOTAL', 16, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text(`${subtotal.toFixed(2)} €`, 189, yPos, { align: 'right' });
  
  yPos += 6;
  doc.setFillColor(173, 216, 230);
  doc.rect(14, yPos - 5, 182, 6, 'F');
  doc.setLineWidth(0.8);
  doc.rect(14, yPos - 5, 140, 6);
  doc.rect(154, yPos - 5, 42, 6);

  doc.setTextColor(0, 102, 204);
  doc.setFont(undefined, 'bold');
  doc.text('IVA 21%', 16, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  doc.text(`${iva.toFixed(2)} €`, 189, yPos, { align: 'right' });
  
  yPos += 6;
  doc.setFillColor(173, 216, 230);
  doc.rect(14, yPos - 5, 182, 6, 'F');
  doc.setLineWidth(0.8);
  doc.rect(14, yPos - 5, 140, 6);
  doc.rect(154, yPos - 5, 42, 6);

  doc.setTextColor(0, 102, 204);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL TOTAL', 16, yPos);
  doc.setTextColor(0, 0, 0);
  doc.text(`${totalTotal.toFixed(2)} €`, 189, yPos, { align: 'right' });

  return doc.output('datauristring');
}
