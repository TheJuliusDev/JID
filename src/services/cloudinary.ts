import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET, hasCloudinaryConfig } from '../config/env';

export interface UploadResult {
  url: string;
  publicId?: string;
  isDemo: boolean;
}

/**
 * Upload a single image file to Cloudinary.
 * If credentials are not present, creates a local Data URL / Object URL preview.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  if (hasCloudinaryConfig) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'jid_campus');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        url: data.secure_url || data.url,
        publicId: data.public_id,
        isDemo: false
      };
    } catch (error) {
      console.warn('[Cloudinary] Upload failed, falling back to local preview URL', error);
    }
  }

  // Fallback: Local Data URL preview for Demo Mode
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        url: (e.target?.result as string) || URL.createObjectURL(file),
        isDemo: true
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload multiple images with sequential/parallel handling
 */
export async function uploadMultipleImages(files: File[]): Promise<UploadResult[]> {
  return Promise.all(files.map(uploadImage));
}

/**
 * Demo fallback images for OAU listings
 */
export const DEMO_PRODUCT_IMAGES = {
  macbook: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
  macbook2: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1000&q=80',
  iphone: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1000&q=80',
  samsung: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=1000&q=80',
  textbooks: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80',
  desk: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1000&q=80',
  chair: 'https://images.unsplash.com/photo-1580481077195-c9973273e5bf?auto=format&fit=crop&w=1000&q=80',
  fan: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?auto=format&fit=crop&w=1000&q=80',
  fashion: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
  fridge: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=1000&q=80',
  // Accommodations
  lodge1: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80',
  lodge2: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80',
  lodge3: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80',
  lodge4: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1000&q=80',
  lodgeExterior: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1000&q=80'
};
