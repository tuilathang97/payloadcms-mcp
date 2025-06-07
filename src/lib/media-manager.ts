/**
 * Media Manager for Bootstrap Operations
 * 
 * Handles media upload and reuse during content generation:
 * - Reuses existing placeholder images when possible
 * - Tracks created media in context
 * - Provides consistent media references for relationships
 */

import { logger } from '../utils/logger.js';
import { PayloadCMSClient } from './payload-client.js';
import { uploadMainPlaceholderImage } from '../utils/media-upload.js';

export interface MediaInfo {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export class MediaManager {
  private mediaCache: Map<string, MediaInfo> = new Map();
  
  constructor(private payloadClient: PayloadCMSClient) {}

  /**
   * Get or create a placeholder image by filename
   */
  async getOrCreatePlaceholderImage(filename: string): Promise<MediaInfo> {
    logger.debug('MediaManager', 'Getting or creating placeholder image', { filename });

    // Check cache first
    if (this.mediaCache.has(filename)) {
      const cached = this.mediaCache.get(filename)!;
      logger.debug('MediaManager', 'Using cached media', { filename, id: cached.id });
      return cached;
    }

    // Check if image already exists in PayloadCMS
    try {
      const existingMedia = await this.findExistingMedia(filename);
      if (existingMedia) {
        this.mediaCache.set(filename, existingMedia);
        logger.info('MediaManager', 'Found existing media', { filename, id: existingMedia.id });
        return existingMedia;
      }
    } catch (error) {
      logger.debug('MediaManager', 'No existing media found', { filename });
    }

    // Create new placeholder image
    try {
      const uploadedMedia = await this.createPlaceholderImage(filename);
      this.mediaCache.set(filename, uploadedMedia);
      logger.info('MediaManager', 'Created new placeholder image', { 
        filename, 
        id: uploadedMedia.id 
      });
      return uploadedMedia;
    } catch (error) {
      logger.error('MediaManager', 'Failed to create placeholder image', error instanceof Error ? error : undefined);
      throw new Error(`Failed to create placeholder image: ${filename}`);
    }
  }

  /**
   * Get multiple placeholder images
   */
  async getOrCreateMultiplePlaceholderImages(filenames: string[]): Promise<MediaInfo[]> {
    const results: MediaInfo[] = [];
    
    for (const filename of filenames) {
      try {
        const media = await this.getOrCreatePlaceholderImage(filename);
        results.push(media);
      } catch (error) {
        logger.warn('MediaManager', 'Failed to get/create image, skipping', { filename, error });
      }
    }
    
    return results;
  }

  /**
   * Get media info by ID
   */
  async getMediaById(id: string): Promise<MediaInfo | null> {
    try {
      const media = await this.payloadClient.findById('media', id);
      return this.formatMediaInfo(media);
    } catch (error) {
      logger.debug('MediaManager', 'Media not found by ID', { id });
      return null;
    }
  }

  /**
   * Find existing media by filename
   */
  private async findExistingMedia(filename: string): Promise<MediaInfo | null> {
    try {
      const result = await this.payloadClient.find('media', {
        where: {
          filename: {
            equals: filename
          }
        },
        limit: 1
      });

      if (result.docs && result.docs.length > 0) {
        return this.formatMediaInfo(result.docs[0]);
      }

      return null;
    } catch (error) {
      logger.debug('MediaManager', 'Error finding existing media', { filename, error });
      return null;
    }
  }

  /**
   * Create a new placeholder image
   */
  private async createPlaceholderImage(filename: string): Promise<MediaInfo> {
    // Use the existing media upload utility
    const uploadedMedia = await uploadMainPlaceholderImage(this.payloadClient, filename);
    return this.formatMediaInfo(uploadedMedia);
  }

  /**
   * Format media document to MediaInfo
   */
  private formatMediaInfo(media: any): MediaInfo {
    return {
      id: media.id,
      filename: media.filename,
      url: media.url || `/api/media/file/${media.filename}`,
      mimeType: media.mimeType || 'image/png',
      width: media.width,
      height: media.height
    };
  }

  /**
   * Get standard placeholder images for common use cases
   */
  async getStandardPlaceholders(): Promise<{
    hero: MediaInfo;
    featured: MediaInfo;
    gallery: MediaInfo[];
    thumbnail: MediaInfo;
  }> {
    const [hero, featured, thumbnail, ...gallery] = await this.getOrCreateMultiplePlaceholderImages([
      'placeholder-hero.png',
      'placeholder-featured.png', 
      'placeholder-thumbnail.png',
      'placeholder-gallery-1.png',
      'placeholder-gallery-2.png',
      'placeholder-gallery-3.png'
    ]);

    return {
      hero: hero || await this.getOrCreatePlaceholderImage('placeholder-image.png'),
      featured: featured || hero || await this.getOrCreatePlaceholderImage('placeholder-image.png'),
      thumbnail: thumbnail || hero || await this.getOrCreatePlaceholderImage('placeholder-image.png'),
      gallery: gallery.length > 0 ? gallery : [hero || await this.getOrCreatePlaceholderImage('placeholder-image.png')]
    };
  }

  /**
   * Generate Lexical image node for rich text fields
   */
  createLexicalImageNode(media: MediaInfo, caption?: string): any {
    return {
      children: [],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'upload',
      version: 1,
      fields: {
        alt: caption || 'Placeholder image',
        caption: caption ? {
          root: {
            children: [{
              children: [{
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: caption,
                type: 'text',
                version: 1
              }],
              direction: 'ltr',
              format: '',
              indent: 0,
              type: 'paragraph',
              version: 1,
              textFormat: 0,
              textStyle: ''
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1
          }
        } : undefined
      },
      relationTo: 'media',
      value: {
        id: media.id
      }
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.mediaCache.clear();
    logger.debug('MediaManager', 'Media cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; items: string[] } {
    return {
      size: this.mediaCache.size,
      items: Array.from(this.mediaCache.keys())
    };
  }

  /**
   * Preload common placeholder images
   */
  async preloadCommonPlaceholders(): Promise<void> {
    logger.info('MediaManager', 'Preloading common placeholder images');
    
    const commonFilenames = [
      'placeholder-image.png',
      'placeholder-hero.png',
      'placeholder-featured.png',
      'placeholder-thumbnail.png'
    ];

    try {
      await this.getOrCreateMultiplePlaceholderImages(commonFilenames);
      logger.info('MediaManager', 'Common placeholders preloaded', { 
        count: commonFilenames.length 
      });
    } catch (error) {
      logger.warn('MediaManager', 'Failed to preload some placeholders', error);
    }
  }
}