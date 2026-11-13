// Foto de perfil. No hay almacén de archivos (Firebase en plan gratuito), así
// que la foto se recorta en cuadrado y se reduce a tamaño de avatar en el
// propio navegador, y se guarda como texto dentro del perfil (`profile.foto`).
// Pesa unos pocos kB: el perfil se lee entero en Mis Alumnos, uno por alumno.

const LADO = 192;                 // px del avatar guardado
const PESO_MAX = 60 * 1024;       // tope del texto guardado
const ARCHIVO_MAX = 20 * 1024 * 1024;
const VALIDA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Solo se pinta una foto que sea de verdad una imagen incrustada y pequeña.
export function fotoValida(foto) {
  return typeof foto === 'string' && foto.length < PESO_MAX * 1.5 && VALIDA.test(foto);
}

export function iniciales(nombre) {
  const p = String(nombre || '').trim().split(/[\s._-]+/).filter(Boolean);
  return p.length ? (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase() : '·';
}

// Contenido del círculo del avatar: la foto si hay, y si no las iniciales.
export function avatarInner(profile, nombre) {
  const foto = profile && profile.foto;
  return fotoValida(foto) ? `<img class="av-img" src="${foto}" alt="">` : esc(iniciales(nombre));
}

// Archivo elegido → imagen cuadrada de 192 px en JPEG, como texto.
export async function prepararFoto(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Elige un archivo de imagen (JPG, PNG o WebP).');
  if (file.size > ARCHIVO_MAX) throw new Error('La imagen pesa demasiado. Prueba con una de menos de 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen. Prueba con otra.'));
      i.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error('No se pudo leer la imagen. Prueba con otra.');
    const lado = Math.min(w, h);
    const c = document.createElement('canvas');
    c.width = c.height = LADO;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';                       // los PNG transparentes, sobre blanco
    ctx.fillRect(0, 0, LADO, LADO);
    ctx.imageSmoothingQuality = 'high';
    // Recorte centrado; en las fotos verticales se sube un poco, que es donde suele estar la cara.
    const sx = (w - lado) / 2, sy = h > w ? (h - lado) * 0.3 : (h - lado) / 2;
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO, LADO);
    for (const q of [0.84, 0.72, 0.6, 0.45]) {
      const data = c.toDataURL('image/jpeg', q);
      if (data.length <= PESO_MAX) return data;
    }
    throw new Error('No se pudo reducir la imagen lo suficiente. Prueba con otra.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
