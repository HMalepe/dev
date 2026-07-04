import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Uploads a buffer to Supabase Storage, creating the bucket first if it
 * doesn't exist yet (public, so rendered assets can be embedded directly
 * in Shotstack timelines / served to viewers without a signed URL).
 * Returns the public URL.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    const { error: createError } = await supabase.storage.createBucket(bucket, { public: true });
    // Ignore "already exists" races (e.g. concurrent cron ticks); surface
    // anything else.
    if (createError && !createError.message?.toLowerCase().includes("already exists")) {
      throw new Error(`Failed to create Supabase Storage bucket "${bucket}": ${createError.message}`);
    }
  }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`Failed to upload to Supabase Storage bucket "${bucket}": ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
  return publicUrlData.publicUrl;
}

/** Downloads a remote file (e.g. a Shotstack/Kling output URL) into memory
 * so it can be mirrored into Supabase Storage. */
export async function downloadToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
