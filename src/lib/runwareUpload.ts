// src/lib/runwareUpload.ts
// Image upload utility for efficient reuse of images across multiple jobs
import { SUPABASE_BASE, SUPABASE_ANON_KEY } from '../config/endpoints';

export async function uploadImage(fileOrUri: { uri: string; type?: string; name?: string } | Blob | string): Promise<string> {
  const url = `${SUPABASE_BASE}/functions/v1/image-upload`;
  
  let body;
  if (typeof fileOrUri === 'string') {
    // Handle data URI or base64 string
    body = { uri: fileOrUri };
  } else if (fileOrUri instanceof Blob) {
    // Handle Blob (web)
    body = { file: fileOrUri };
  } else {
    // Handle React Native file object
    body = { file: fileOrUri };
  }


  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Upload failed');
      throw new Error(`Upload failed: ${res.status} ${errorText}`);
    }
    
    const j = await res.json();
    return j.imageUUID as string;
  } catch (error) {
    throw error;
  }
}

// Helper function to convert React Native image picker result to upload format
export function prepareImageForUpload(imagePickerResult: any): { uri: string; type?: string; name?: string } | null {
  if (!imagePickerResult || !imagePickerResult.assets || imagePickerResult.assets.length === 0) {
    return null;
  }

  const asset = imagePickerResult.assets[0];
  return {
    uri: asset.uri,
    type: asset.type || 'image/jpeg',
    name: asset.fileName || `image_${Date.now()}.jpg`,
  };
}

// Helper to check if an image reference is already an imageUUID
export function isImageUUID(ref: string): boolean {
  // Runware imageUUIDs are typically UUIDs or have specific format
  // This is a simple check - you might want to make it more specific based on your Runware setup
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref) || 
         ref.startsWith('runware_') ||
         ref.length === 36; // Standard UUID length
}

// Helper to upload image if it's not already an imageUUID
export async function ensureImageUUID(imageRef: string): Promise<string> {
  if (isImageUUID(imageRef)) {
    return imageRef; // Already an imageUUID, return as-is
  }
  
  // Upload the image to get an imageUUID
  return await uploadImage(imageRef);
}
