import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Upload a pet profile photo to the 'pet-photos' bucket.
 * Returns the public URL, or null if upload fails or no file provided.
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const ALLOWED_MIME_PREFIXES = ['image/'];

export async function uploadPetPhoto(
  file: File | null,
  userId: string,
  supabase: SupabaseClient,
  folder = 'pet-profile',
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_FILE_SIZE) return null;

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return null;
  if (!ALLOWED_MIME_PREFIXES.some(p => file.type.startsWith(p))) return null;

  const filePath = `${userId}/${folder}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('pet-photos')
    .upload(filePath, file, { upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from('pet-photos').getPublicUrl(filePath);
  return data.publicUrl;
}
