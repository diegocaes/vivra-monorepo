import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

/**
 * HEIC/HEIF es el formato por defecto de la cámara del iPhone. Safari en iOS
 * lo convierte a JPEG al elegirlo desde `<input type="file">`, pero si el
 * archivo llega tal cual (por ejemplo desde un Mac), **ningún navegador lo
 * pinta en un <img>**: la subida "funciona" y el usuario ve un cuadro roto.
 * Mejor rechazarlo con un mensaje claro que guardar algo que no se ve.
 */
const NO_RENDERIZABLES = new Set(['heic', 'heif']);

export interface ResultadoSubida {
  url: string | null;
  /** Mensaje listo para mostrar. null si todo salió bien. */
  error: string | null;
}

/**
 * Sube una imagen al bucket 'pet-photos' y devuelve su URL pública.
 *
 * Devuelve el motivo del fallo en vez de solo `null`: antes cualquier error
 * (archivo grande, formato raro, caída de red) se tragaba en silencio y la
 * página redirigía igual con `?saved=1`, así que el usuario creía que había
 * guardado el carné cuando no había subido nada.
 */
export async function subirImagen(
  file: File | null,
  userId: string,
  supabase: SupabaseClient,
  folder = 'pet-profile',
): Promise<ResultadoSubida> {
  if (!file || file.size === 0) return { url: null, error: null }; // no eligió nada

  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return { url: null, error: `La imagen pesa ${mb} MB y el máximo son 10 MB. Prueba con una foto más liviana.` };
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();

  if (NO_RENDERIZABLES.has(ext)) {
    return { url: null, error: 'Ese formato (HEIC) no se ve en el navegador. En tu iPhone: Ajustes → Cámara → Formatos → "Más compatible", o toma una captura de pantalla del carné.' };
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { url: null, error: 'Formato no admitido. Usa una foto JPG, PNG o WEBP.' };
  }

  if (!file.type.startsWith('image/')) {
    return { url: null, error: 'Ese archivo no es una imagen.' };
  }

  const filePath = `${userId}/${folder}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('pet-photos')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (error) {
    return { url: null, error: 'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.' };
  }

  const { data } = supabase.storage.from('pet-photos').getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

/**
 * Borra del bucket el archivo al que apunta una URL pública.
 *
 * Sin esto, "eliminar" solo ponía la columna en null y la foto seguía viva —
 * y accesible— en el bucket para siempre. Falla en silencio a propósito: si
 * el borrado del archivo no funciona, la fila igual debe quedar limpia.
 */
export async function borrarImagenPorUrl(
  url: string | null | undefined,
  supabase: SupabaseClient,
): Promise<void> {
  if (!url) return;
  try {
    const marca = '/pet-photos/';
    const i = url.indexOf(marca);
    if (i === -1) return;
    const path = decodeURIComponent(url.slice(i + marca.length).split('?')[0]);
    if (!path) return;
    await supabase.storage.from('pet-photos').remove([path]);
  } catch {
    // El archivo huérfano es un costo menor; nunca bloquear al usuario por esto.
  }
}

/**
 * Compatibilidad con las páginas que solo quieren la URL.
 * Las nuevas deberían usar `subirImagen` para poder mostrar el error.
 */
export async function uploadPetPhoto(
  file: File | null,
  userId: string,
  supabase: SupabaseClient,
  folder = 'pet-profile',
): Promise<string | null> {
  const { url } = await subirImagen(file, userId, supabase, folder);
  return url;
}
