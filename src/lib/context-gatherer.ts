import { fsTools, ProjectStructure } from './fs-tools.js';
import { ConfigParser, PayloadConfig, PayloadCollection, PayloadBlock, PayloadField } from './config-parser.js';
import path from 'path';

export interface ConfigFile {
  path: string;
  content: string;
  type: 'config' | 'collection' | 'block' | 'global';
}

export interface DiscoveredConfig {
  collections: string[];
  blocks: string[];
  globals: string[];
  structure: ProjectStructure;
}

export interface RequiredFile {
  path: string;
  description: string;
  optional: boolean;
  type: 'config' | 'collection' | 'block' | 'global';
}

export interface ContextGatheringResponse {
  status: 'needs_context' | 'in_progress' | 'complete';
  message: string;
  requiredFiles?: RequiredFile[];
  nextStep?: string;
  discoveredConfig?: DiscoveredConfig;
  parsedConfig?: PayloadConfig;
  sampleContent?: any;
  error?: string;
}

export interface ContextGatheringRequest {
  projectPath: string;
  step?: 'discover_config' | 'generate_content';
  configurationFiles?: ConfigFile[];
  discoveredConfig?: DiscoveredConfig;
}

export class ContextGatherer {
  private configParser: ConfigParser | null = null;

  /**
   * Main entry point for progressive context gathering
   */
  public async gatherContext(request: ContextGatheringRequest): Promise<ContextGatheringResponse> {
    try {
      const { projectPath, step = 'discover_config', configurationFiles, discoveredConfig } = request;

      // Validate project path
      if (!projectPath) {
        return {
          status: 'needs_context',
          message: 'Project path is required',
          error: 'Missing required parameter: projectPath'
        };
      }

      if (!fsTools.pathExists(projectPath)) {
        return {
          status: 'needs_context',
          message: 'Project path does not exist',
          error: `Path not found: ${projectPath}`
        };
      }

      switch (step) {
        case 'discover_config':
          return await this.discoverProjectConfig(projectPath);
          
        case 'generate_content':
          if (!configurationFiles || !discoveredConfig) {
            return {
              status: 'needs_context',
              message: 'Configuration files and discovered config are required for content generation',
              error: 'Missing configuration data for content generation step'
            };
          }
          return await this.processConfigurationFiles(configurationFiles, discoveredConfig);
          
        default:
          return {
            status: 'needs_context',
            message: 'Invalid step provided',
            error: `Unknown step: ${step}`
          };
      }
    } catch (error) {
      return {
        status: 'needs_context',
        message: 'Error during context gathering',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Discover project configuration and structure
   */
  private async discoverProjectConfig(projectPath: string): Promise<ContextGatheringResponse> {
    try {
      // Analyze project structure
      const structure = fsTools.analyzeProject(projectPath);
      
      if (!structure.hasPayloadConfig) {
        return {
          status: 'needs_context',
          message: 'No PayloadCMS configuration found',
          error: 'Could not find payload.config.ts or payload.config.js in project',
          nextStep: 'provide_config_path'
        };
      }

      // Initialize config parser
      this.configParser = new ConfigParser(structure.configPath!, structure.tsconfigPath);
      
      // Parse the main config to discover collections and blocks
      let parsedConfig: PayloadConfig;
      try {
        parsedConfig = await this.configParser.parsePayloadConfig();
      } catch (parseError) {
        return {
          status: 'needs_context',
          message: 'Failed to parse PayloadCMS configuration',
          error: parseError instanceof Error ? parseError.message : 'Configuration parsing failed',
          nextStep: 'fix_config_syntax'
        };
      }

      // Create discovered config summary
      const discoveredConfig: DiscoveredConfig = {
        collections: parsedConfig.collections.map(c => c.slug).filter(Boolean),
        blocks: parsedConfig.blocks.map(b => b.slug).filter(Boolean),
        globals: parsedConfig.globals?.map((g: any) => g.slug).filter(Boolean) || [],
        structure
      };

      // Check if main config already has complete collection/block definitions
      const hasCompleteCollections = this.checkMainConfigCompleteness(parsedConfig, discoveredConfig);
      
      if (hasCompleteCollections) {
        // Main config has everything we need, use it directly
        const sampleContent = this.generateSampleContentStructure(parsedConfig, discoveredConfig);
        
        return {
          status: 'complete',
          message: `Successfully parsed complete configuration from main config with ${parsedConfig.collections.length} collections, ${parsedConfig.blocks.length} blocks, and ${parsedConfig.globals?.length || 0} globals`,
          discoveredConfig,
          parsedConfig,
          sampleContent
        };
      }
      
      // Main config doesn't have complete definitions, try to read additional files
      const requiredFiles = this.getRequiredConfigFiles(structure, discoveredConfig);
      
      if (requiredFiles.length > 0) {
        // Read all required configuration files automatically
        const configFiles: ConfigFile[] = [];
        
        for (const fileInfo of requiredFiles) {
          if (fsTools.pathExists(fileInfo.path)) {
            try {
              const content = fsTools.readFile(fileInfo.path);
              configFiles.push({
                path: fileInfo.path,
                content,
                type: fileInfo.type
              });
            } catch (readError) {
              console.warn(`Failed to read ${fileInfo.path}:`, readError);
              // Continue with other files
            }
          }
        }
        
        // Process the configuration files we read
        if (configFiles.length > 0) {
          // Merge additional config with main config
          return await this.processConfigurationFiles(configFiles, discoveredConfig, parsedConfig);
        }
      }

      // Generate sample content structure
      const sampleContent = this.generateSampleContentStructure(parsedConfig, discoveredConfig);

      // We have everything we need from the main config
      return {
        status: 'complete',
        message: 'Configuration discovery complete',
        discoveredConfig,
        parsedConfig,
        sampleContent
      };
    } catch (error) {
      return {
        status: 'needs_context',
        message: 'Error during project discovery',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process provided configuration files to build complete schema
   */
  private async processConfigurationFiles(
    configFiles: ConfigFile[], 
    discoveredConfig: DiscoveredConfig,
    baseConfig?: PayloadConfig
  ): Promise<ContextGatheringResponse> {
    try {
      if (!this.configParser) {
        // Reinitialize if needed
        this.configParser = new ConfigParser(
          discoveredConfig.structure.configPath!,
          discoveredConfig.structure.tsconfigPath
        );
      }

      const parsedConfig: PayloadConfig = {
        collections: baseConfig?.collections || [],
        blocks: baseConfig?.blocks || [],
        globals: baseConfig?.globals || []
      };

      // Process each provided configuration file
      for (const configFile of configFiles) {
        try {
          switch (configFile.type) {
            case 'collection':
              const collection = await this.parseCollectionFromContent(configFile);
              if (collection) {
                parsedConfig.collections.push(collection);
              }
              break;
              
            case 'block':
              const block = await this.parseBlockFromContent(configFile);
              if (block) {
                parsedConfig.blocks.push(block);
              }
              break;
              
            case 'global':
              // Parse global configurations (similar to collections)
              const global = await this.parseGlobalFromContent(configFile);
              if (global) {
                parsedConfig.globals = parsedConfig.globals || [];
                parsedConfig.globals.push(global);
              }
              break;
              
            case 'config':
              // Main config - re-parse with provided content
              const mainConfig = await this.parseMainConfigFromContent(configFile);
              if (mainConfig) {
                // Merge collections, blocks, globals from main config
                parsedConfig.collections.push(...mainConfig.collections);
                parsedConfig.blocks.push(...mainConfig.blocks);
                if (mainConfig.globals) {
                  parsedConfig.globals = parsedConfig.globals || [];
                  parsedConfig.globals.push(...mainConfig.globals);
                }
              }
              break;
          }
        } catch (fileError) {
          console.warn(`Failed to parse ${configFile.path}:`, fileError);
          // Continue processing other files
        }
      }

      // Validate that we have a complete schema
      const validation = this.validateParsedConfig(parsedConfig, discoveredConfig);
      
      if (!validation.isComplete) {
        // If validation fails but we have a base config, try to use what we have
        if (baseConfig && (baseConfig.collections.length > 0 || baseConfig.blocks.length > 0)) {
          console.warn('Using incomplete configuration from main config:', validation.message);
          // Continue with partial config rather than failing
        } else {
          return {
            status: 'needs_context',
            message: validation.message,
            requiredFiles: validation.missingFiles || [],
            nextStep: 'provide_missing_files',
            discoveredConfig,
            parsedConfig
          };
        }
      }

      // Generate sample content structure
      const sampleContent = this.generateSampleContentStructure(parsedConfig, discoveredConfig);

      return {
        status: 'complete',
        message: `Successfully parsed complete configuration with ${parsedConfig.collections.length} collections, ${parsedConfig.blocks.length} blocks, and ${parsedConfig.globals?.length || 0} globals`,
        discoveredConfig,
        parsedConfig,
        sampleContent
      };
    } catch (error) {
      return {
        status: 'needs_context',
        message: 'Error processing configuration files',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if main config has complete collection/block definitions
   */
  private checkMainConfigCompleteness(parsedConfig: PayloadConfig, discoveredConfig: DiscoveredConfig): boolean {
    // Check if all discovered collections have complete field definitions
    for (const collectionSlug of discoveredConfig.collections) {
      const collection = parsedConfig.collections.find(c => c.slug === collectionSlug);
      if (!collection || !collection.fields || collection.fields.length === 0) {
        return false;
      }
    }
    
    // Check if all discovered blocks have complete field definitions
    for (const blockSlug of discoveredConfig.blocks) {
      const block = parsedConfig.blocks.find(b => b.slug === blockSlug);
      if (!block || !block.fields || block.fields.length === 0) {
        return false;
      }
    }
    
    // Check if all discovered globals have complete field definitions (if any)
    for (const globalSlug of discoveredConfig.globals) {
      const global = parsedConfig.globals?.find((g: any) => g.slug === globalSlug);
      if (!global || !global.fields || global.fields.length === 0) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get required configuration files based on discovered structure
   */
  private getRequiredConfigFiles(structure: ProjectStructure, discoveredConfig: DiscoveredConfig): RequiredFile[] {
    const required: RequiredFile[] = [];

    // Get base required files from fs-tools
    const baseFiles = fsTools.getRequiredConfigFiles(structure);
    
    // Convert to our RequiredFile format and add type information
    for (const file of baseFiles) {
      let type: 'config' | 'collection' | 'block' | 'global' = 'config';
      
      if (file.path.includes('/collections/') || file.path.includes('\\collections\\')) {
        type = 'collection';
      } else if (file.path.includes('/blocks/') || file.path.includes('\\blocks\\')) {
        type = 'block';
      } else if (file.path.includes('/globals/') || file.path.includes('\\globals\\')) {
        type = 'global';
      }
      
      required.push({
        path: file.path,
        description: file.description,
        optional: file.optional,
        type
      });
    }

    // Filter out main config file as it's already been processed
    return required.filter(file => file.path !== structure.configPath);
  }

  /**
   * Parse collection from provided file content
   */
  private async parseCollectionFromContent(configFile: ConfigFile): Promise<PayloadCollection | null> {
    // Create temporary file to parse content
    const tempFilePath = path.join(process.cwd(), 'temp_collection_config.ts');
    
    try {
      // Write content to temporary file and parse
      const fs = await import('fs');
      fs.writeFileSync(tempFilePath, configFile.content);
      
      const collection = await this.configParser!.parseCollectionConfig(tempFilePath);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      return collection;
    } catch (error) {
      // Clean up temp file on error
      try {
        const fs = await import('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
      
      throw error;
    }
  }

  /**
   * Parse block from provided file content
   */
  private async parseBlockFromContent(configFile: ConfigFile): Promise<PayloadBlock | null> {
    // Create temporary file to parse content
    const tempFilePath = path.join(process.cwd(), 'temp_block_config.ts');
    
    try {
      // Write content to temporary file and parse
      const fs = await import('fs');
      fs.writeFileSync(tempFilePath, configFile.content);
      
      const block = await this.configParser!.parseBlockConfig(tempFilePath);
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      return block;
    } catch (error) {
      // Clean up temp file on error
      try {
        const fs = await import('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
      
      throw error;
    }
  }

  /**
   * Parse global from provided file content (similar to collection)
   */
  private async parseGlobalFromContent(configFile: ConfigFile): Promise<any | null> {
    // For now, treat globals similar to collections
    return await this.parseCollectionFromContent(configFile);
  }

  /**
   * Parse main config from provided file content
   */
  private async parseMainConfigFromContent(configFile: ConfigFile): Promise<PayloadConfig | null> {
    // Create temporary file to parse content
    const tempFilePath = path.join(process.cwd(), 'temp_main_config.ts');
    
    try {
      // Write content to temporary file and parse
      const fs = await import('fs');
      fs.writeFileSync(tempFilePath, configFile.content);
      
      // Create new parser instance for the temp file
      const tempParser = new ConfigParser(tempFilePath);
      const config = await tempParser.parsePayloadConfig();
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      return config;
    } catch (error) {
      // Clean up temp file on error
      try {
        const fs = await import('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
      
      throw error;
    }
  }

  /**
   * Validate that parsed config is complete
   */
  private validateParsedConfig(
    parsedConfig: PayloadConfig, 
    discoveredConfig: DiscoveredConfig
  ): { isComplete: boolean; message: string; missingFiles?: RequiredFile[] } {
    // Check for collections that exist but have incomplete field definitions
    const incompleteCollections = discoveredConfig.collections.filter(slug => {
      const collection = parsedConfig.collections.find(c => c.slug === slug);
      return !collection || !collection.fields || collection.fields.length === 0;
    });
    
    // Check for blocks that exist but have incomplete field definitions
    const incompleteBlocks = discoveredConfig.blocks.filter(slug => {
      const block = parsedConfig.blocks.find(b => b.slug === slug);
      return !block || !block.fields || block.fields.length === 0;
    });

    // Check for globals that exist but have incomplete field definitions
    const incompleteGlobals = discoveredConfig.globals.filter(slug => {
      const global = parsedConfig.globals?.find((g: any) => g.slug === slug);
      return !global || !global.fields || global.fields.length === 0;
    });

    // If we have basic structure (slugs match) but just missing detailed fields, that's often OK
    const hasBasicStructure = (
      discoveredConfig.collections.every(slug => parsedConfig.collections.some(c => c.slug === slug)) &&
      discoveredConfig.blocks.every(slug => parsedConfig.blocks.some(b => b.slug === slug)) &&
      discoveredConfig.globals.every(slug => parsedConfig.globals?.some((g: any) => g.slug === slug))
    );

    if (incompleteCollections.length === 0 && incompleteBlocks.length === 0 && incompleteGlobals.length === 0) {
      return {
        isComplete: true,
        message: 'Configuration is complete with full field definitions'
      };
    }

    // If we have basic structure but some incomplete fields, we can still proceed with warnings
    if (hasBasicStructure && (incompleteCollections.length > 0 || incompleteBlocks.length > 0 || incompleteGlobals.length > 0)) {
      return {
        isComplete: true,
        message: `Configuration has basic structure but some items have minimal field definitions. Collections: ${incompleteCollections.join(', ')}, Blocks: ${incompleteBlocks.join(', ')}, Globals: ${incompleteGlobals.join(', ')}`
      };
    }

    const missingFiles: RequiredFile[] = [];
    
    // Generate missing file paths (these are estimates)
    const baseDir = path.dirname(discoveredConfig.structure.configPath!);
    
    for (const collection of incompleteCollections) {
      missingFiles.push({
        path: path.join(baseDir, 'collections', collection, 'index.ts'),
        description: `Collection configuration for ${collection}`,
        optional: false,
        type: 'collection'
      });
    }
    
    for (const block of incompleteBlocks) {
      missingFiles.push({
        path: path.join(baseDir, 'blocks', block, 'index.ts'),
        description: `Block configuration for ${block}`,
        optional: false,
        type: 'block'
      });
    }

    for (const global of incompleteGlobals) {
      missingFiles.push({
        path: path.join(baseDir, 'globals', global, 'index.ts'),
        description: `Global configuration for ${global}`,
        optional: false,
        type: 'global'
      });
    }

    return {
      isComplete: false,
      message: `Missing complete configurations for: ${[...incompleteCollections, ...incompleteBlocks, ...incompleteGlobals].join(', ')}`,
      missingFiles
    };
  }

  /**
   * Generate sample content structure with all required fields populated
   */
  private generateSampleContentStructure(parsedConfig: PayloadConfig, discoveredConfig: DiscoveredConfig): any {
    const sampleContent: any = {
      collections: {},
      blocks: {},
      globals: {}
    };

    // Generate sample content for each collection
    for (const collection of parsedConfig.collections) {
      sampleContent.collections[collection.slug] = this.generateSampleForCollection(collection);
    }

    // Generate sample content for each block
    for (const block of parsedConfig.blocks) {
      sampleContent.blocks[block.slug] = this.generateSampleForBlock(block);
    }

    // Generate sample content for globals if they exist
    if (parsedConfig.globals) {
      for (const global of parsedConfig.globals) {
        sampleContent.globals[global.slug] = this.generateSampleForGlobal(global);
      }
    }

    return sampleContent;
  }

  /**
   * Generate sample content for a collection with all required fields
   */
  private generateSampleForCollection(collection: PayloadCollection): any {
    const sample: any = {
      slug: collection.slug,
      labels: collection.labels || { singular: collection.slug, plural: collection.slug + 's' },
      sampleData: this.generateSampleFieldData(collection.fields)
    };

    return sample;
  }

  /**
   * Generate sample content for a block with all required fields
   */
  private generateSampleForBlock(block: PayloadBlock): any {
    const sample: any = {
      slug: block.slug,
      labels: block.labels || { singular: block.slug, plural: block.slug + 's' },
      sampleData: this.generateSampleFieldData(block.fields)
    };

    return sample;
  }

  /**
   * Generate sample content for a global with all required fields
   */
  private generateSampleForGlobal(global: any): any {
    const sample: any = {
      slug: global.slug,
      labels: global.labels || { singular: global.slug, plural: global.slug + 's' },
      sampleData: this.generateSampleFieldData(global.fields || [])
    };

    return sample;
  }

  /**
   * Generate sample data for an array of fields
   */
  private generateSampleFieldData(fields: PayloadField[]): any {
    const sampleData: any = {};

    for (const field of fields) {
      sampleData[field.name] = this.generateSampleFieldValue(field);
    }

    return sampleData;
  }

  /**
   * Generate sample value for a specific field based on its type
   */
  private generateSampleFieldValue(field: PayloadField): any {
    const variants = ['sample', 'example', 'demo', 'test'];
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];

    switch (field.type) {
      case 'text':
        if (field.name === 'title' || field.name === 'name') {
          return `${randomVariant} ${field.name}`;
        }
        if (field.name === 'slug') {
          return `${randomVariant}-${field.name}`;
        }
        return `${randomVariant} ${field.name} content`;

      case 'textarea':
        return `This is ${randomVariant} ${field.name} content. It can contain multiple lines of text.`;

      case 'richText':
        return {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: `This is ${randomVariant} rich text content for ${field.name}.`
                  }
                ]
              }
            ]
          }
        };

      case 'number':
        if (field.name === 'price') {
          return Math.floor(Math.random() * 500) + 10;
        }
        if (field.name === 'rating') {
          return Math.floor(Math.random() * 5) + 1;
        }
        return Math.floor(Math.random() * 100);

      case 'email':
        return `${randomVariant}@example.com`;

      case 'select':
        if (field.options && field.options.length > 0) {
          const randomOption = field.options[Math.floor(Math.random() * field.options.length)];
          return randomOption.value || randomOption;
        }
        return 'draft';

      case 'checkbox':
        return Math.random() > 0.5;

      case 'date':
        return new Date().toISOString();

      case 'upload':
        return {
          filename: `${randomVariant}-image.jpg`,
          alt: `${randomVariant} image`,
          url: `https://via.placeholder.com/800x600?text=${randomVariant}`
        };

      case 'relationship':
        if (field.relationTo) {
          if (Array.isArray(field.relationTo)) {
            return {
              relationTo: field.relationTo[0],
              value: `${randomVariant}-id-123`
            };
          }
          return `${randomVariant}-${field.relationTo}-id`;
        }
        return null;

      case 'array':
        if (field.fields) {
          return [this.generateSampleFieldData(field.fields)];
        }
        return [`${randomVariant} array item`];

      case 'group':
        if (field.fields) {
          return this.generateSampleFieldData(field.fields);
        }
        return {};

      case 'blocks':
        if (field.blocks && field.blocks.length > 0) {
          const randomBlock = field.blocks[Math.floor(Math.random() * field.blocks.length)];
          return [
            {
              blockType: randomBlock,
              id: `block-${Date.now()}-${Math.random()}`,
              [`${randomVariant}Field`]: `${randomVariant} block content`
            }
          ];
        }
        return [];

      case 'tabs':
        if (field.tabs) {
          const tabData: any = {};
          for (const tab of field.tabs) {
            const tabSampleData = this.generateSampleFieldData(tab.fields);
            Object.assign(tabData, tabSampleData);
          }
          return tabData;
        }
        return {};

      case 'json':
        return {
          [`${randomVariant}Key`]: `${randomVariant} value`,
          nested: {
            property: `${randomVariant} nested value`
          }
        };

      case 'code':
        return `// ${randomVariant} code\nconsole.log('${randomVariant}');`;

      case 'point':
        return [Math.random() * 180 - 90, Math.random() * 360 - 180]; // [lat, lng]

      default:
        return `${randomVariant} ${field.type} value`;
    }
  }
}

export const contextGatherer = new ContextGatherer();