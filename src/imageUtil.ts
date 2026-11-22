// Reducir imágenes en el navegador (para enviarlas al servidor o guardarlas en las notas sin ocupar mucho).

/** Miniatura cuadrada (recorte centrado) de una imagen ya cargada (data URL): la cara del personaje en la lista de la party */
export async function squareThumb(src: string, size = 64, quality = 0.7): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  // Recorte un poco por arriba: en los retratos la cara suele estar en la mitad superior
  ctx.drawImage(img, (img.naturalWidth - side) / 2, Math.max(0, (img.naturalHeight - side) / 4), side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Reduce la imagen a `max` px como mucho y la pasa a JPEG */
export async function compressImage(file: Blob, max = 1600, quality = 0.82): Promise<{ data: string; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k); const h = Math.round(img.naturalHeight * k);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return { data: canvas.toDataURL('image/jpeg', quality), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}
