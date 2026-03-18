import { useRef, useEffect } from 'react';
import { formatPrice } from '../lib/fileReader';
import { cleanArticle } from '../lib/textCleaner';
import { getLabelSizeInfo } from '../lib/config';

const CANVAS_W = 500;
const CANVAS_H = 360;

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = current + ' ' + words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawLabel(ctx, product, sizeInfo) {
  const lw = sizeInfo.width_mm;
  const lh = sizeInfo.height_mm;
  const aspect = lw / lh;

  // Scale card to fit canvas with padding
  const pad = 30;
  let cardW = CANVAS_W - pad * 2;
  let cardH = cardW / aspect;
  if (cardH > CANVAS_H - pad * 2) {
    cardH = CANVAS_H - pad * 2;
    cardW = cardH * aspect;
  }
  const cx = (CANVAS_W - cardW) / 2;
  const cy = (CANVAS_H - cardH) / 2;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cx, cy, cardW, cardH);
  ctx.shadowColor = 'transparent';

  // Border
  ctx.strokeStyle = '#D8DADF';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx, cy, cardW, cardH);

  if (!product) return;

  const article = cleanArticle(product.article || '');
  const price = formatPrice(product.pvente || 0);
  const ppro = formatPrice(product.ppro || 0);
  const pproHtva = formatPrice(product.ppro_htva || 0);

  // Golden ratio fonts
  const fPro = Math.max(9, Math.round(lh * 0.085));
  const fTitle = Math.round(fPro * 1.61);
  const fPrice = Math.round(fTitle * 1.61);

  // Scale factor from mm to card px
  const sf = cardW / lw;
  const margin = 3 * sf;

  // Article
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fTitle * sf}px Inter, system-ui, sans-serif`;
  const maxTextW = cardW - margin * 2;
  let lines = wrapText(ctx, article, maxTextW);
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = lines[1] + '...';
  }
  const lineH = fTitle * sf * 1.2;
  const artY = cy + margin + fTitle * sf;
  for (let i = 0; i < lines.length; i++) {
    const tw = ctx.measureText(lines[i]).width;
    ctx.fillText(lines[i], cx + (cardW - tw) / 2, artY + i * lineH);
  }

  // Price
  const priceText = price + ' \u20AC';
  ctx.font = `bold ${fPrice * sf}px Inter, system-ui, sans-serif`;
  const artBlockH = lines.length * lineH;
  const remainH = cardH - artBlockH - margin * 2;
  const priceY = cy + margin + artBlockH + remainH / 2 + (fPrice * sf) / 3;
  const pw = ctx.measureText(priceText).width;
  ctx.fillText(priceText, cx + (cardW - pw) / 2, priceY);

  // Pro prices
  const proText = `PPHT ${pproHtva}   PPTTC ${ppro}`;
  ctx.fillStyle = '#444444';
  ctx.font = `${fPro * sf}px Inter, system-ui, sans-serif`;
  const proW = ctx.measureText(proText).width;
  ctx.fillText(proText, cx + cardW - margin - proW, cy + cardH - margin);
}

function drawA4(ctx, product, bgImage) {
  const aspect = 297 / 210; // portrait ratio (width/height in landscape = 297/210)
  const pad = 20;

  // A4 landscape: wider than tall
  const a4Aspect = 297 / 210;
  let cardW = CANVAS_W - pad * 2;
  let cardH = cardW / a4Aspect;
  if (cardH > CANVAS_H - pad * 2) {
    cardH = CANVAS_H - pad * 2;
    cardW = cardH * a4Aspect;
  }
  const cx = (CANVAS_W - cardW) / 2;
  const cy = (CANVAS_H - cardH) / 2;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(cx, cy, cardW, cardH);
  ctx.shadowColor = 'transparent';

  // Background image
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    ctx.drawImage(bgImage, cx, cy, cardW, cardH);
  }

  // Border
  ctx.strokeStyle = '#D8DADF';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx, cy, cardW, cardH);

  if (!product) return;

  const article = cleanArticle(product.article || '');
  const price = formatPrice(product.pvente || 0);
  const ppro = formatPrice(product.ppro || 0);
  const pproHtva = formatPrice(product.ppro_htva || 0);
  const pl = product.p_l || '';
  const origine = product.origine || '';

  const headerH = (90 / 210) * cardH;
  const safeH = cardH - headerH;
  const margin = 10;

  // Article
  const fTitle = Math.round(cardH * 0.065 * 1.44);
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fTitle}px Inter, system-ui, sans-serif`;
  const maxW = cardW - margin * 2;
  let lines = wrapText(ctx, article, maxW);
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = lines[1] + '...';
  }
  const lineH = fTitle * 1.2;
  const artY = cy + headerH + fTitle * 1.2;
  for (let i = 0; i < lines.length; i++) {
    const tw = ctx.measureText(lines[i]).width;
    ctx.fillText(lines[i], cx + (cardW - tw) / 2, artY + i * lineH);
  }

  // Price
  const fPrice = Math.round(cardH * 0.12 * 1.2);
  const priceText = price + ' \u20AC';
  ctx.font = `bold ${fPrice}px Inter, system-ui, sans-serif`;
  const priceY = cy + headerH + safeH * 0.46 + fPrice / 3;
  const pw = ctx.measureText(priceText).width;
  ctx.fillText(priceText, cx + (cardW - pw) / 2, priceY);

  // P/L bottom-left
  if (pl) {
    const fSmall = Math.round(cardH * 0.04);
    ctx.font = `${fSmall}px Inter, system-ui, sans-serif`;
    const plY = cy + headerH + safeH * 0.72;
    ctx.fillText(String(pl), cx + margin, plY);
  }

  // Origine bottom-right
  if (origine) {
    const fSmall = Math.round(cardH * 0.04);
    ctx.font = `${fSmall}px Inter, system-ui, sans-serif`;
    const origText = `Origine : ${origine}`;
    const ow = ctx.measureText(origText).width;
    const origY = cy + headerH + safeH * 0.72;
    ctx.fillText(origText, cx + cardW - margin - ow, origY);
  }

  // Pro prices
  const fPro = Math.round(cardH * 0.035);
  ctx.fillStyle = '#444444';
  ctx.font = `${fPro}px Inter, system-ui, sans-serif`;
  const proText = `PPHT ${pproHtva}    PPTTC ${ppro}`;
  const proW = ctx.measureText(proText).width;
  const proY = cy + headerH + safeH * 0.85;
  ctx.fillText(proText, cx + cardW - margin - proW, proY);
}

export default function PreviewCanvas({ product, format, bgImage }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Fill bg
    ctx.fillStyle = '#EDEEF0';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (format === 'label') {
      drawLabel(ctx, product, getLabelSizeInfo());
    } else {
      drawA4(ctx, product, bgImage);
    }
  }, [product, format, bgImage]);

  return (
    <div className="flex justify-center px-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-lg"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
