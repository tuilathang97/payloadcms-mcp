/**
 * Media Upload Utilities for PayloadCMS MCP Server
 * 
 * Handles uploading placeholder images and media content to PayloadCMS
 */

import { PayloadCMSClient } from '../lib/payload-client.js';
import * as fs from 'fs';
import * as path from 'path';

// Get current file directory for resolving paths 
// Note: For ES modules in Node.js, we use __dirname alternative
const __dirname = path.dirname(new URL(import.meta.url).pathname);

export interface UploadedMedia {
  id: string;
  filename: string;
  alt: string;
  url?: string;
  [key: string]: any; // Allow additional properties from PayloadCMS
}

/**
 * Upload a single placeholder image to PayloadCMS
 */
export async function uploadPlaceholderImage(
  payloadClient: PayloadCMSClient,
  suffix?: string
): Promise<UploadedMedia> {
  try {
    // Get path to placeholder image (go up from dist/utils/ to public/)
    const projectRoot = path.resolve(__dirname, '../../');
    const placeholderPath = path.join(projectRoot, 'public', 'placeholder-image.png');
    
    if (!fs.existsSync(placeholderPath)) {
      console.warn(`Placeholder image not found at ${placeholderPath}, creating fallback media entry`);
      const fallbackDoc = await payloadClient.create('media', {
        filename: suffix ? `placeholder-${suffix}.png` : 'placeholder.png',
        alt: `Placeholder image${suffix ? ` ${suffix}` : ''}`,
        url: 'https://via.placeholder.com/800x600'
      });
      return {
        ...fallbackDoc,
        filename: suffix ? `placeholder-${suffix}.png` : 'placeholder.png',
        alt: `Placeholder image${suffix ? ` ${suffix}` : ''}`
      };
    }

    // Read the image file
    const imageBuffer = fs.readFileSync(placeholderPath);
    const filename = suffix ? `placeholder-image-${suffix}.png` : 'placeholder-image.png';
    
    // Upload the actual file to PayloadCMS
    const uploadedMedia = await payloadClient.uploadFile(
      imageBuffer,
      filename,
      'image/png',
      'media'
    );

    return {
      ...uploadedMedia,
      filename,
      alt: `Placeholder image${suffix ? ` ${suffix}` : ''}`
    };
  } catch (error) {
    console.warn('Failed to upload placeholder image, creating fallback:', error);
    // Fallback to creating media entry without actual file
    const fallbackDoc = await payloadClient.create('media', {
      filename: suffix ? `placeholder-${suffix}.png` : 'placeholder-image.png',
      alt: `Placeholder image${suffix ? ` ${suffix}` : ''}`,
      url: 'https://via.placeholder.com/800x600'
    });
    return {
      ...fallbackDoc,
      filename: suffix ? `placeholder-${suffix}.png` : 'placeholder-image.png',
      alt: `Placeholder image${suffix ? ` ${suffix}` : ''}`
    };
  }
}

/**
 * Upload the main placeholder image (single upload)
 */
export async function uploadMainPlaceholderImage(
  payloadClient: PayloadCMSClient,
  customFilename?: string
): Promise<UploadedMedia> {
  if (customFilename) {
    // Extract suffix from custom filename (remove extension)
    const suffix = customFilename.replace(/\.[^/.]+$/, "");
    return await uploadPlaceholderImage(payloadClient, suffix);
  }
  return await uploadPlaceholderImage(payloadClient);
}

/**
 * Generate media upload data without actual file upload (for sample content)
 */
export function generateSampleMediaData(suffix?: string): UploadedMedia {
  return {
    id: `sample-media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    filename: suffix ? `placeholder-${suffix}.png` : 'placeholder-image.png',
    alt: `Sample placeholder image${suffix ? ` ${suffix}` : ''}`,
    url: `https://via.placeholder.com/800x600?text=${suffix || 'placeholder'}`
  };
}

/**
 * Check if placeholder image exists
 */
export function placeholderImageExists(): boolean {
  const projectRoot = path.resolve(__dirname, '../../');
  const placeholderPath = path.join(projectRoot, 'public', 'placeholder-image.png');
  return fs.existsSync(placeholderPath);
}

/**
 * Get placeholder image path
 */
export function getPlaceholderImagePath(): string {
  const projectRoot = path.resolve(__dirname, '../../');
  return path.join(projectRoot, 'public', 'placeholder-image.png');
}