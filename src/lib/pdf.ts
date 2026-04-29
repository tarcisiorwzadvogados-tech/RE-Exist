import { RestorationLog } from '../types';

interface CertificateOptions {
  restoredImage: string;
  img: HTMLImageElement;
  currentLog: RestorationLog | undefined;
  originalFileName: string;
  selectedResolution: string;
  prompt: string;
}

export const generateCertificatePDF = async ({
  restoredImage, img, currentLog, originalFileName, selectedResolution, prompt,
}: CertificateOptions) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('RE-EXIST', margin, 25);
  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.text('TECHNICAL RESTORATION CERTIFICATE', margin, 32);
  doc.text(`ID: ${currentLog?.id || 'N/A'}`, pageWidth - margin - 40, 25);

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Restored Asset:', margin, 55);

  const maxImgWidth = pageWidth - margin * 2;
  const maxImgHeight = 120;
  let imgW = img.width;
  let imgH = img.height;
  const ratio = imgW / imgH;
  if (imgW > maxImgWidth) { imgW = maxImgWidth; imgH = imgW / ratio; }
  if (imgH > maxImgHeight) { imgH = maxImgHeight; imgW = imgH * ratio; }
  doc.addImage(restoredImage, 'PNG', (pageWidth - imgW) / 2, 65, imgW, imgH);

  const specsY = 65 + imgH + 10;
  const boxWidth = pageWidth - margin * 2;
  const innerPadding = 5;
  const contentWidth = boxWidth - innerPadding * 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Technical Specifications:', margin + innerPadding, specsY + 8);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  const specs = [
    `Original File: ${currentLog?.fileName || originalFileName}`,
    `Date: ${currentLog?.timestamp.toLocaleString() || new Date().toLocaleString()}`,
    `Engine: ${currentLog?.model || 'Unknown'}`,
    `Resolution: ${currentLog?.resolution || selectedResolution}`,
    `Technician: ${process.env.USER_EMAIL || 'tarcisio.rwzadvogados@gmail.com'}`,
  ];
  specs.forEach((spec, i) => doc.text(spec, margin + innerPadding + 5, specsY + 16 + i * 4.5));

  const promptTitleY = specsY + 16 + specs.length * 4.5 + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Restoration Protocol (Prompt):', margin + innerPadding, promptTitleY);
  doc.setFont('courier', 'italic');
  doc.setFontSize(7.5);
  const restorationPrompt = currentLog?.prompt || prompt;
  const promptStartY = promptTitleY + 5;
  const splitPrompt = doc.splitTextToSize(restorationPrompt, contentWidth - 5);
  const promptHeight = splitPrompt.length * 3.5;
  doc.text(restorationPrompt, margin + innerPadding + 5, promptStartY, {
    align: 'justify', maxWidth: contentWidth - 10,
  });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.1);
  doc.rect(margin, specsY, boxWidth, promptStartY - specsY + promptHeight + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'This document certifies that the image above has undergone a digital restoration process using generative neural networks.',
    margin, pageHeight - 15,
  );
  doc.text('RE-EXIST LABORATORY - MEMORY RESISTANCE PROTOCOL', margin, pageHeight - 10);

  doc.save(`${originalFileName}_certificate.pdf`);
};

export const generateReceiptPDF = async (restorationHistory: RestorationLog[]) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const total = restorationHistory.reduce((sum, item) => sum + item.cost, 0);

  doc.setFontSize(20);
  doc.text('Restoration Session Receipt', 20, 20);
  doc.setFontSize(10);
  doc.text(`Date: ${new Date().toLocaleString()}`, 20, 30);
  doc.text(`User: ${process.env.USER_EMAIL || 'tarcisio.rwzadvogados@gmail.com'}`, 20, 35);
  doc.setLineWidth(0.5);
  doc.line(20, 40, 190, 40);

  let y = 50;
  doc.setFontSize(12);
  doc.text('Itemized Costs', 20, y);
  y += 10;

  doc.setFontSize(9);
  ['Date', 'File Name', 'Model', 'Res', 'Cost'].forEach((h, i) => {
    doc.text(h, [20, 50, 100, 140, 170][i], y);
  });
  y += 5;
  doc.line(20, y, 190, y);
  y += 7;

  restorationHistory.forEach((item) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(item.timestamp.toLocaleDateString(), 20, y);
    doc.text(item.fileName.substring(0, 20), 50, y);
    doc.text(item.model, 100, y);
    doc.text(item.resolution, 140, y);
    doc.text(`$${item.cost.toFixed(2)}`, 170, y);
    y += 7;
  });

  y += 5;
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Cost: $${total.toFixed(2)}`, 140, y);
  doc.save(`restoration-receipt-${new Date().getTime()}.pdf`);
};
