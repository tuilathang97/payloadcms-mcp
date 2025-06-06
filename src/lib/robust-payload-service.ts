import * as fs from 'fs';
import * as path from 'path';
import { ConfigParser, PayloadConfig, PayloadCollection, PayloadBlock } from './config-parser.js';
import { ContentGenerator } from './content-generator.js';
import { PayloadCMSClient } from './payload-client.js';
// import { RelationshipManager } from './relationship-manager.js';

export interface ProjectAnalysis {
  config: PayloadConfig;
  configFiles: string[];
  collections: PayloadCollection[];
  blocks: PayloadBlock[];
  relationships: Map<string, string[]>;
  issues: string[];
  summary: {
    totalCollections: number;
    totalBlocks: number;
    totalFields: number;
    hasRelationships: boolean;
    hasBlocks: boolean;
  };
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
  fieldCount: number;
  complexityScore: number;
}

export class RobustPayloadService {
  private configParser: ConfigParser;
  private contentGenerator: ContentGenerator;
  private payloadClient: PayloadCMSClient;
  // private relationshipManager: RelationshipManager;

  constructor(
    payloadClient: PayloadCMSClient,
    tsconfigPath?: string
  ) {
    this.payloadClient = payloadClient;
    this.contentGenerator = new ContentGenerator();
    // this.relationshipManager = new RelationshipManager(payloadClient, this.contentGenerator);
    
    // ConfigParser will be initialized per operation since it needs the config path
    this.configParser = new ConfigParser('', tsconfigPath);
  }

  /**
   * Test PayloadCMS connection and provide diagnostic information
   */
  public async testConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      await this.payloadClient.initialize();
      const isConnected = await this.payloadClient.ping();
      return { connected: isConnected };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Parse the main payload.config.ts file
   */
  public async parsePayloadConfig(
    payloadConfigPath: string,
    tsconfigPath?: string,
    projectRoot?: string
  ): Promise<PayloadConfig> {
    // If payloadConfigPath is absolute, use it directly
    // If relative, resolve against projectRoot (or cwd if not provided)
    const fullConfigPath = path.isAbsolute(payloadConfigPath) 
      ? payloadConfigPath 
      : path.resolve(projectRoot || process.cwd(), payloadConfigPath);
    
    if (!fs.existsSync(fullConfigPath)) {
      throw new Error(`PayloadCMS config file not found: ${fullConfigPath}`);
    }

    this.configParser = new ConfigParser(fullConfigPath, tsconfigPath);
    return await this.configParser.parsePayloadConfig();
  }

  /**
   * Discover all config files in a project
   */
  public async discoverConfigFiles(
    projectRoot: string,
    patterns: string[] = ['**/config.ts', '**/config.js', '**/index.ts', '**/index.js'],
    excludeDirs: string[] = ['node_modules', '.git', 'dist', 'build', '.next']
  ): Promise<string[]> {
    if (!path.isAbsolute(projectRoot)) {
      throw new Error(`Project root must be an absolute path. Received: "${projectRoot}". Please provide the full path from filesystem root.`);
    }
    const configFiles: string[] = [];
    
    const searchDir = (dir: string, depth: number = 0) => {
      if (depth > 10) return; // Prevent infinite recursion
      
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (excludeDirs.includes(item)) continue;
          
          searchDir(fullPath, depth + 1);
        } else if (stat.isFile()) {
          // Check if file matches any pattern
          for (const pattern of patterns) {
            const regexPattern = new RegExp(
              pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\./g, '\\.')
            );
            
            if (regexPattern.test(fullPath.replace(projectRoot, ''))) {
              configFiles.push(fullPath);
              break;
            }
          }
        }
      }
    };

    searchDir(path.resolve(projectRoot));
    return configFiles;
  }

  /**
   * Parse a specific collection config file
   */
  public async parseCollectionConfig(
    configFilePath: string,
    tsconfigPath?: string
  ): Promise<PayloadCollection | null> {
    if (!path.isAbsolute(configFilePath)) {
      throw new Error(`Collection config file path must be absolute. Received: "${configFilePath}". Please provide the full path from filesystem root.`);
    }
    
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Collection config file not found: ${configFilePath}`);
    }

    const parser = new ConfigParser(configFilePath, tsconfigPath);
    return await parser.parseCollectionConfig(configFilePath);
  }

  /**
   * Parse a specific block config file
   */
  public async parseBlockConfig(
    configFilePath: string,
    tsconfigPath?: string
  ): Promise<PayloadBlock | null> {
    if (!path.isAbsolute(configFilePath)) {
      throw new Error(`Block config file path must be absolute. Received: "${configFilePath}". Please provide the full path from filesystem root.`);
    }
    
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Block config file not found: ${configFilePath}`);
    }

    const parser = new ConfigParser(configFilePath, tsconfigPath);
    return await parser.parseBlockConfig(configFilePath);
  }

  /**
   * Generate sample data from parsed configuration
   */
  public generateSampleFromConfig(
    type: 'collection' | 'block',
    configData: PayloadCollection | PayloadBlock,
    count: number = 3,
    includeOptional: boolean = true,
    locale: string = 'en'
  ): any[] {
    if (type === 'collection') {
      return this.contentGenerator.generateCollectionSampleContent(
        configData as PayloadCollection,
        count
      );
    } else {
      return this.contentGenerator.generateBlockSampleContent(
        configData as PayloadBlock,
        count
      );
    }
  }

  /**
   * Create documents from configuration
   */
  public async createDocumentsFromConfig(
    collectionSlug: string,
    configData: PayloadCollection,
    count: number = 3,
    resolveRelationships: boolean = true,
    createMedia: boolean = false
  ): Promise<any[]> {
    try {
      // Ensure PayloadCMS client is initialized before creating documents
      await this.payloadClient.initialize();
      
      const sampleData = this.contentGenerator.generateCollectionSampleContent(configData, count);
      const results: any[] = [];

      for (const data of sampleData) {
        let processedData = data;
        
               if (resolveRelationships) {
           // For now, we'll use the data as-is and let the relationship manager
           // handle relationship creation via the existing methods
           // In a more complete implementation, we'd need to analyze the relationships
           // and create dependent documents first
           processedData = data;
         }

        const document = await this.payloadClient.create(collectionSlug, processedData);
        results.push(document);
      }

      return results;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        throw new Error(`Failed to authenticate with PayloadCMS. Please check your credentials in the environment variables (PAYLOAD_HOST, PAYLOAD_USERNAME, PAYLOAD_PASSWORD, or PAYLOAD_API_KEY). Original error: ${error.message}`);
      }
      throw new Error(`Failed to create documents in collection '${collectionSlug}': ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate configuration structure
   */
  public validateConfigStructure(
    configData: PayloadCollection | PayloadBlock,
    type: 'collection' | 'block' | 'global',
    strict: boolean = false
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      issues: [],
      warnings: [],
      fieldCount: 0,
      complexityScore: 0
    };

    // Check basic structure
    if (!configData.slug) {
      result.issues.push('Missing required slug property');
      result.valid = false;
    }

    if (!configData.fields || !Array.isArray(configData.fields)) {
      result.issues.push('Missing or invalid fields array');
      result.valid = false;
    } else {
      result.fieldCount = this.countFields(configData.fields);
      result.complexityScore = this.calculateComplexity(configData.fields);
      
      // Validate individual fields
      this.validateFields(configData.fields, result, strict);
    }

    return result;
  }

  /**
   * Analyze complete project structure
   */
  public async analyzeProjectStructure(
    payloadConfigPath: string,
    tsconfigPath?: string,
    includeUnused: boolean = true,
    generateReport: boolean = true
  ): Promise<ProjectAnalysis> {
    const analysis: ProjectAnalysis = {
      config: { collections: [], blocks: [] },
      configFiles: [],
      collections: [],
      blocks: [],
      relationships: new Map(),
      issues: [],
      summary: {
        totalCollections: 0,
        totalBlocks: 0,
        totalFields: 0,
        hasRelationships: false,
        hasBlocks: false
      }
    };

    try {
      // Parse main config (now expects absolute paths)
      analysis.config = await this.parsePayloadConfig(
        payloadConfigPath,
        tsconfigPath
      );

      // Discover all config files in the directory containing the config
      if (includeUnused) {
        const configDirectory = path.dirname(payloadConfigPath);
        analysis.configFiles = await this.discoverConfigFiles(
          configDirectory
        );
      }

      // Parse collections
      for (const collection of analysis.config.collections) {
        analysis.collections.push(collection);
        
        // Analyze relationships
        const relationships = this.extractRelationships(collection.fields);
        if (relationships.length > 0) {
          analysis.relationships.set(collection.slug, relationships);
          analysis.summary.hasRelationships = true;
        }
      }

      // Parse blocks
      for (const block of analysis.config.blocks) {
        analysis.blocks.push(block);
        
        const relationships = this.extractRelationships(block.fields);
        if (relationships.length > 0) {
          analysis.relationships.set(block.slug, relationships);
        }
      }

      // Update summary
      analysis.summary.totalCollections = analysis.collections.length;
      analysis.summary.totalBlocks = analysis.blocks.length;
      analysis.summary.totalFields = analysis.collections.reduce(
        (total, collection) => total + this.countFields(collection.fields),
        0
      ) + analysis.blocks.reduce(
        (total, block) => total + this.countFields(block.fields),
        0
      );
      analysis.summary.hasBlocks = analysis.blocks.length > 0;

    } catch (error) {
      analysis.issues.push(`Failed to analyze project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return analysis;
  }

  /**
   * Create complete dataset for project
   */
  public async createCompleteDataset(
    payloadConfigPath: string,
    tsconfigPath?: string,
    collectionsToInclude?: string[],
    documentsPerCollection: number = 3,
    resolveAllRelationships: boolean = true,
    createMediaAssets: boolean = false,
    dryRun: boolean = false
  ): Promise<{ created: any[], errors: string[], summary: any }> {
    const result = {
      created: [] as any[],
      errors: [] as string[],
      summary: {
        totalDocuments: 0,
        collectionsProcessed: 0,
        relationshipsResolved: 0,
        mediaCreated: 0
      }
    };

    try {
      // Parse configuration (now expects absolute paths)
      const config = await this.parsePayloadConfig(payloadConfigPath, tsconfigPath);
      
      // Filter collections if specified
      const collectionsToProcess = collectionsToInclude 
        ? config.collections.filter(c => collectionsToInclude.includes(c.slug))
        : config.collections;

      // Process collections in dependency order
      const orderedCollections = this.orderCollectionsByDependencies(collectionsToProcess);

      for (const collection of orderedCollections) {
        try {
          if (!dryRun) {
            const documents = await this.createDocumentsFromConfig(
              collection.slug,
              collection,
              documentsPerCollection,
              resolveAllRelationships,
              createMediaAssets
            );
            
            result.created.push(...documents);
            result.summary.totalDocuments += documents.length;
          } else {
            // Dry run - just generate sample data
            const sampleData = this.generateSampleFromConfig(
              'collection',
              collection,
              documentsPerCollection
            );
            result.created.push({
              collection: collection.slug,
              sampleData,
              wouldCreate: documentsPerCollection
            });
          }
          
          result.summary.collectionsProcessed++;
        } catch (error) {
          result.errors.push(`Failed to process collection ${collection.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

    } catch (error) {
      result.errors.push(`Failed to create dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Helper methods
   */
  private countFields(fields: any[]): number {
    let count = 0;
    
    for (const field of fields) {
      count++;
      
      if (field.fields) {
        count += this.countFields(field.fields);
      }
      
      if (field.tabs) {
        for (const tab of field.tabs) {
          if (tab.fields) {
            count += this.countFields(tab.fields);
          }
        }
      }
    }
    
    return count;
  }

  private calculateComplexity(fields: any[]): number {
    let complexity = 0;
    
    for (const field of fields) {
      // Base complexity per field
      complexity += 1;
      
      // Additional complexity for complex field types
      switch (field.type) {
        case 'blocks':
          complexity += 3;
          break;
        case 'array':
          complexity += 2;
          break;
        case 'group':
          complexity += 2;
          break;
        case 'tabs':
          complexity += 2;
          break;
        case 'relationship':
          complexity += 2;
          break;
        case 'upload':
          complexity += 1;
          break;
      }
      
      // Recursive complexity for nested fields
      if (field.fields) {
        complexity += this.calculateComplexity(field.fields);
      }
      
      if (field.tabs) {
        for (const tab of field.tabs) {
          if (tab.fields) {
            complexity += this.calculateComplexity(tab.fields);
          }
        }
      }
    }
    
    return complexity;
  }

  private validateFields(fields: any[], result: ValidationResult, strict: boolean): void {
    for (const field of fields) {
      // Check required properties
      if (!field.type) {
        result.issues.push(`Field missing type property: ${field.name || 'unnamed field'}`);
        result.valid = false;
      }

      // Type-specific validation
      if (field.type === 'relationship' && !field.relationTo) {
        result.issues.push(`Relationship field missing relationTo: ${field.name}`);
        result.valid = false;
      }

      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        result.issues.push(`Select field missing options: ${field.name}`);
        result.valid = false;
      }

      // Strict mode checks
      if (strict) {
        if (!field.name && field.type !== 'tabs' && field.type !== 'row' && field.type !== 'collapsible') {
          result.warnings.push(`Field missing name property: ${field.type} field`);
        }
      }

      // Recursive validation
      if (field.fields) {
        this.validateFields(field.fields, result, strict);
      }

      if (field.tabs) {
        for (const tab of field.tabs) {
          if (tab.fields) {
            this.validateFields(tab.fields, result, strict);
          }
        }
      }
    }
  }

  private extractRelationships(fields: any[]): string[] {
    const relationships: string[] = [];
    
    for (const field of fields) {
      if (field.type === 'relationship' && field.relationTo) {
        if (Array.isArray(field.relationTo)) {
          relationships.push(...field.relationTo);
        } else {
          relationships.push(field.relationTo);
        }
      }

      if (field.fields) {
        relationships.push(...this.extractRelationships(field.fields));
      }

      if (field.tabs) {
        for (const tab of field.tabs) {
          if (tab.fields) {
            relationships.push(...this.extractRelationships(tab.fields));
          }
        }
      }
    }
    
    return [...new Set(relationships)]; // Remove duplicates
  }

  private orderCollectionsByDependencies(collections: PayloadCollection[]): PayloadCollection[] {
    const ordered: PayloadCollection[] = [];
    const remaining = [...collections];
    const processing = new Set<string>();

    const addCollection = (collection: PayloadCollection) => {
      if (ordered.find(c => c.slug === collection.slug)) {
        return; // Already added
      }

      if (processing.has(collection.slug)) {
        // Circular dependency - add anyway
        ordered.push(collection);
        return;
      }

      processing.add(collection.slug);

      // Find dependencies
      const dependencies = this.extractRelationships(collection.fields);
      
      // Add dependencies first
      for (const dep of dependencies) {
        const depCollection = remaining.find(c => c.slug === dep);
        if (depCollection) {
          addCollection(depCollection);
        }
      }

      ordered.push(collection);
      processing.delete(collection.slug);
    };

    while (remaining.length > 0) {
      const collection = remaining.shift()!;
      addCollection(collection);
    }

    return ordered;
  }
} 