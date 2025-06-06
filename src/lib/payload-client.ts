/**
 * PayloadCMS REST API Client
 * 
 * This client handles all communication with PayloadCMS via the REST API,
 * including authentication, CRUD operations, and configuration retrieval.
 */

import axios, { AxiosInstance } from 'axios';
import { z } from 'zod';

// Configuration schema
const PayloadConfigSchema = z.object({
  host: z.string().url(),
  email: z.string().optional(),
  password: z.string().optional(),
  apiKey: z.string().optional(),
});

type PayloadConfig = z.infer<typeof PayloadConfigSchema>;

// PayloadCMS API response schemas
const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});

const DocumentSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough(); // Allow additional fields

const CollectionResponseSchema = z.object({
  docs: z.array(DocumentSchema),
  totalDocs: z.number(),
  limit: z.number(),
  page: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export interface FindOptions {
  limit?: number;
  page?: number;
  where?: Record<string, any>;
  sort?: string;
  depth?: number;
  populate?: string[];
}

export interface PayloadDocument {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CollectionConfig {
  slug: string;
  labels: {
    singular: string;
    plural: string;
  };
  fields: FieldConfig[];
  auth?: boolean;
  upload?: boolean;
  timestamps?: boolean;
}

export interface FieldConfig {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  relationTo?: string | string[];
  hasMany?: boolean;
  blocks?: BlockConfig[];
  fields?: FieldConfig[]; // For group, array, and block fields
  [key: string]: any;
}

export interface BlockConfig {
  slug: string;
  labels: {
    singular: string;
    plural: string;
  };
  fields: FieldConfig[];
}

export class PayloadCMSClient {
  private config: PayloadConfig;
  private client: AxiosInstance;
  private token?: string;
  private isInitialized = false;

  constructor(config: PayloadConfig) {
    this.config = PayloadConfigSchema.parse(config);
    
    this.client = axios.create({
      baseURL: `${this.config.host}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.client.interceptors.request.use((config: any) => {
      if (this.token) {
        config.headers!.Authorization = `JWT ${this.token}`;
      } else if (this.config.apiKey) {
        config.headers!.Authorization = `Bearer ${this.config.apiKey}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        if (error.response?.status === 401) {
          this.token = undefined as any;
          throw new Error('Authentication failed. Please check your credentials.');
        }
        throw error;
      }
    );
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // If using email/password, authenticate to get token
    if (this.config.email && this.config.password && !this.config.apiKey) {
      console.log(`Authenticating with PayloadCMS using email: ${this.config.email}`);
      await this.authenticate();
    } else if (this.config.apiKey) {
      console.log('Using API key for PayloadCMS authentication');
    } else {
      throw new Error('PayloadCMS authentication credentials missing. Provide either email/password or apiKey');
    }

    this.isInitialized = true;
  }

  private async authenticate(): Promise<void> {
    try {
      console.log(`Attempting to authenticate with ${this.config.host}/api/users/login`);
      const response = await this.client.post('/users/login', {
        email: this.config.email,
        password: this.config.password,
      });

      const authData = AuthResponseSchema.parse(response.data);
      this.token = authData.token;
      console.log('Authentication successful, token obtained');
    } catch (error: any) {
      if (error.response) {
        console.error('Authentication failed with status:', error.response.status);
        console.error('Response data:', error.response.data);
        throw new Error(`PayloadCMS authentication failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
        console.error('Authentication network error:', error.message);
        throw new Error(`Failed to connect to PayloadCMS for authentication: ${error.message}`);
      }
    }
  }

  async find(
    collection: string,
    options: FindOptions = {}
  ): Promise<{ docs: PayloadDocument[]; totalDocs: number; totalPages: number }> {
    this.ensureInitialized();

    const params: Record<string, any> = {
      limit: options.limit || 10,
      page: options.page || 1,
      depth: options.depth || 1,
    };

    if (options.where) {
      params['where'] = JSON.stringify(options.where);
    }

    if (options.sort) {
      params['sort'] = options.sort;
    }

    if (options.populate) {
      params['populate'] = options.populate.join(',');
    }

    try {
      const response = await this.client.get(`/${collection}`, { params });
      const data = CollectionResponseSchema.parse(response.data);
      
      return {
        docs: data.docs,
        totalDocs: data.totalDocs,
        totalPages: data.totalPages,
      };
    } catch (error) {
      throw new Error(`Failed to find documents in collection '${collection}': ${error}`);
    }
  }

  async findById(
    collection: string,
    id: string,
    depth = 1
  ): Promise<PayloadDocument> {
    this.ensureInitialized();

    try {
      const response = await this.client.get(`/${collection}/${id}`, {
        params: { depth },
      });
      return DocumentSchema.parse(response.data);
    } catch (error) {
      throw new Error(`Failed to find document with ID '${id}' in collection '${collection}': ${error}`);
    }
  }

  async create(
    collection: string,
    data: Record<string, any>
  ): Promise<PayloadDocument> {
    this.ensureInitialized();

    try {
      const response = await this.client.post(`/${collection}`, data);
      return DocumentSchema.parse(response.data.doc);
    } catch (error) {
      throw new Error(`Failed to create document in collection '${collection}': ${error}`);
    }
  }

  async update(
    collection: string,
    id: string,
    data: Record<string, any>
  ): Promise<PayloadDocument> {
    this.ensureInitialized();

    try {
      const response = await this.client.patch(`/${collection}/${id}`, data);
      return DocumentSchema.parse(response.data.doc);
    } catch (error) {
      throw new Error(`Failed to update document with ID '${id}' in collection '${collection}': ${error}`);
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.client.delete(`/${collection}/${id}`);
    } catch (error) {
      throw new Error(`Failed to delete document with ID '${id}' in collection '${collection}': ${error}`);
    }
  }

  async uploadFile(
    file: Buffer,
    filename: string,
    mimeType: string,
    collection = 'media'
  ): Promise<PayloadDocument> {
    this.ensureInitialized();

    const formData = new FormData();
    const blob = new Blob([file], { type: mimeType });
    formData.append('file', blob, filename);

    try {
      const response = await this.client.post(`/${collection}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return DocumentSchema.parse(response.data.doc);
    } catch (error) {
      throw new Error(`Failed to upload file '${filename}': ${error}`);
    }
  }

  async getCollectionConfig(collection: string): Promise<CollectionConfig> {
    this.ensureInitialized();

    try {
      // Note: This endpoint might not be available in all PayloadCMS instances
      // Alternative: Store config locally or extract from admin API
      const response = await this.client.get(`/${collection}/config`);
      return response.data;
    } catch (error) {
      // Fallback: Try to infer config from a sample document
      console.warn(`Config endpoint not available for collection '${collection}', using inference`);
      return this.inferCollectionConfig(collection);
    }
  }

  private async inferCollectionConfig(collection: string): Promise<CollectionConfig> {
    // Get a sample document to infer the structure
    const { docs } = await this.find(collection, { limit: 1 });
    
    if (docs.length === 0) {
      throw new Error(`Cannot infer config for empty collection '${collection}'`);
    }

    const sampleDoc = docs[0]!;
    const fields: FieldConfig[] = [];

    // Infer field types from the document structure
    Object.entries(sampleDoc).forEach(([key, value]) => {
      if (key === 'id' || key === 'createdAt' || key === 'updatedAt') {
        return; // Skip meta fields
      }

      fields.push({
        name: key,
        type: this.inferFieldType(value),
        required: false,
      });
    });

    return {
      slug: collection,
      labels: {
        singular: collection,
        plural: collection,
      },
      fields,
    };
  }

  private inferFieldType(value: any): string {
    if (typeof value === 'string') return 'text';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'checkbox';
    if (Array.isArray(value)) return 'array';
    if (value && typeof value === 'object') {
      if (value.id) return 'relationship';
      return 'group';
    }
    return 'text';
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('PayloadCMS client not initialized. Call initialize() first.');
    }
  }

  // Additional utility methods
  async getCollections(): Promise<string[]> {
    this.ensureInitialized();

    try {
      // This is a hypothetical endpoint - might need to be implemented differently
      const response = await this.client.get('/collections');
      return response.data.collections.map((c: any) => c.slug);
    } catch (error) {
      // Fallback: Return common collection names
      console.warn('Collections endpoint not available, using defaults');
      return ['pages', 'posts', 'media', 'users'];
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      return false;
    }
  }
} 