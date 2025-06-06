#!/usr/bin/env node

/**
 * PayloadCMS MCP Server
 * 
 * This server provides robust MCP tools for interacting with PayloadCMS
 * by parsing actual configuration files and generating accurate sample data.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import * as path from 'path';
import { PayloadCMSClient } from './lib/payload-client.js';
// import { LexicalGenerator } from './lib/lexical-generator.js';
import { RobustPayloadService } from './lib/robust-payload-service.js';
import {
  parsePayloadConfigTool,
  discoverConfigFilesTool,
  parseCollectionConfigTool,
  parseBlockConfigTool,
  generateSampleFromConfigTool,
  createDocumentsFromConfigTool,
  validateConfigStructureTool,
  analyzeProjectStructureTool,
  createCompleteDatasetTool,
  testPayloadConnectionTool
} from './tools/robust-tools.js';

// Load environment variables
config();

class PayloadCMSMCPServer {
  private server: Server;
  private payloadClient: PayloadCMSClient;
  // private lexicalGenerator: LexicalGenerator;
  private robustService: RobustPayloadService;

  constructor() {
    this.server = new Server(
      {
        name: process.env['MCP_SERVER_NAME'] || 'PayloadCMS MCP Server',
        version: process.env['MCP_SERVER_VERSION'] || '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize PayloadCMS client
    this.payloadClient = new PayloadCMSClient({
      host: process.env['PAYLOAD_HOST'] || 'http://localhost:3000',
      username: process.env['PAYLOAD_USERNAME'] || '',
      password: process.env['PAYLOAD_PASSWORD'] || '',
      apiKey: process.env['PAYLOAD_API_KEY'],
    });

    // Initialize services
    // this.lexicalGenerator = new LexicalGenerator();
    this.robustService = new RobustPayloadService(
      this.payloadClient,
      process.env['TSCONFIG_PATH']
    );

    this.setupHandlers();
  }

  /**
   * Validate that a file path is absolute as required by MCP best practices
   */
  private validateAbsolutePath(filePath: string, paramName: string): void {
    if (!path.isAbsolute(filePath)) {
      throw new Error(`${paramName} must be an absolute path. Received: "${filePath}". Please provide the full path from filesystem root (e.g., "/Users/username/project/file.ts") to ensure reliable operation across different working directories.`);
    }
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          parsePayloadConfigTool,
          discoverConfigFilesTool,
          parseCollectionConfigTool,
          parseBlockConfigTool,
          generateSampleFromConfigTool,
          createDocumentsFromConfigTool,
          validateConfigStructureTool,
          analyzeProjectStructureTool,
          createCompleteDatasetTool,
          testPayloadConnectionTool
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'parsePayloadConfig':
            return await this.handleParsePayloadConfig(args);

          case 'discoverConfigFiles':
            return await this.handleDiscoverConfigFiles(args);

          case 'parseCollectionConfig':
            return await this.handleParseCollectionConfig(args);

          case 'parseBlockConfig':
            return await this.handleParseBlockConfig(args);

          case 'generateSampleFromConfig':
            return await this.handleGenerateSampleFromConfig(args);

          case 'createDocumentsFromConfig':
            return await this.handleCreateDocumentsFromConfig(args);

          case 'validateConfigStructure':
            return await this.handleValidateConfigStructure(args);

          case 'analyzeProjectStructure':
            return await this.handleAnalyzeProjectStructure(args);

          case 'createCompleteDataset':
            return await this.handleCreateCompleteDataset(args);

          case 'testPayloadConnection':
            return await this.handleTestPayloadConnection(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  // Robust tool handlers
  private async handleParsePayloadConfig(args: any) {
    const { payloadConfigPath, tsconfigPath, projectRoot } = args;
    
    // Validate paths are absolute as required by MCP best practices
    this.validateAbsolutePath(payloadConfigPath, 'payloadConfigPath');
    if (tsconfigPath) {
      this.validateAbsolutePath(tsconfigPath, 'tsconfigPath');
    }
    const finalProjectRoot = projectRoot || path.dirname(payloadConfigPath);
    this.validateAbsolutePath(finalProjectRoot, 'projectRoot');
    
    const config = await this.robustService.parsePayloadConfig(
      payloadConfigPath,
      tsconfigPath,
      finalProjectRoot
    );

    return {
      content: [
        {
          type: 'text',
          text: `Successfully parsed PayloadCMS configuration:\n\n**Collections:** ${config.collections.length}\n${config.collections.map(c => `- ${c.slug} (${c.fields.length} fields)`).join('\n')}\n\n**Blocks:** ${config.blocks.length}\n${config.blocks.map(b => `- ${b.slug} (${b.fields.length} fields)`).join('\n')}\n\n**Full Configuration:**\n\`\`\`json\n${JSON.stringify({
            collections: config.collections.map(c => ({ 
              slug: c.slug, 
              fieldsCount: c.fields.length,
              labels: c.labels 
            })),
            blocks: config.blocks.map(b => ({ 
              slug: b.slug, 
              fieldsCount: b.fields.length,
              labels: b.labels 
            }))
          }, null, 2)}\n\`\`\``,
        },
      ],
    };
  }

  private async handleDiscoverConfigFiles(args: any) {
    const { projectRoot, patterns, excludeDirs } = args;
    
    // Validate project root is absolute
    this.validateAbsolutePath(projectRoot, 'projectRoot');
    
    const configFiles = await this.robustService.discoverConfigFiles(
      projectRoot,
      patterns,
      excludeDirs
    );

    return {
      content: [
        {
          type: 'text',
          text: `Found ${configFiles.length} configuration files:\n\n${configFiles.map(file => `- ${file}`).join('\n')}\n\n**Suggestions:**\n- Use \`parseCollectionConfig\` for collection config files\n- Use \`parseBlockConfig\` for block config files\n- Use \`parsePayloadConfig\` for the main payload.config.ts file`,
        },
      ],
    };
  }

  private async handleParseCollectionConfig(args: any) {
    const { configFilePath, tsconfigPath } = args;
    
    // Validate paths are absolute as required by MCP best practices
    this.validateAbsolutePath(configFilePath, 'configFilePath');
    if (tsconfigPath) {
      this.validateAbsolutePath(tsconfigPath, 'tsconfigPath');
    }
    
    const collection = await this.robustService.parseCollectionConfig(
      configFilePath,
      tsconfigPath
    );

    if (!collection) {
      throw new Error(`Failed to parse collection config from ${configFilePath}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully parsed collection **"${collection.slug}"**:\n\n**Field Count:** ${collection.fields.length}\n**Labels:** ${JSON.stringify(collection.labels, null, 2)}\n\n**Field Summary:**\n${collection.fields.map(f => `- ${f.name || f.type}: ${f.type}${f.required ? ' (required)' : ''}`).join('\n')}\n\n**Next Steps:**\n- Use \`generateSampleFromConfig\` to create sample data\n- Use \`createDocumentsFromConfig\` to create actual documents\n- Use \`validateConfigStructure\` to validate the configuration`,
        },
      ],
    };
  }

  private async handleParseBlockConfig(args: any) {
    const { configFilePath, tsconfigPath } = args;
    
    // Validate paths are absolute as required by MCP best practices
    this.validateAbsolutePath(configFilePath, 'configFilePath');
    if (tsconfigPath) {
      this.validateAbsolutePath(tsconfigPath, 'tsconfigPath');
    }
    
    const block = await this.robustService.parseBlockConfig(
      configFilePath,
      tsconfigPath
    );

    if (!block) {
      throw new Error(`Failed to parse block config from ${configFilePath}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully parsed block **"${block.slug}"**:\n\n**Field Count:** ${block.fields.length}\n**Labels:** ${JSON.stringify(block.labels, null, 2)}\n\n**Field Summary:**\n${block.fields.map(f => `- ${f.name || f.type}: ${f.type}${f.required ? ' (required)' : ''}`).join('\n')}\n\n**Next Steps:**\n- Use \`generateSampleFromConfig\` to create sample data\n- Use this block in collections that support it`,
        },
      ],
    };
  }

  private async handleGenerateSampleFromConfig(args: any) {
    const { type, configData, count = 3, includeOptional = true, locale = 'en' } = args;
    
    const sampleData = this.robustService.generateSampleFromConfig(
      type,
      configData,
      count,
      includeOptional,
      locale
    );

    return {
      content: [
        {
          type: 'text',
          text: `Generated ${count} sample ${type} items:\n\n\`\`\`json\n${JSON.stringify(sampleData, null, 2)}\n\`\`\`\n\n**Next Steps:**\n- Review the generated data structure\n- Use \`createDocumentsFromConfig\` to create actual PayloadCMS documents\n- Modify field configurations if needed`,
        },
      ],
    };
  }

  private async handleCreateDocumentsFromConfig(args: any) {
    const { collectionSlug, configData, count = 3, resolveRelationships = true, createMedia = false } = args;
    
    const documents = await this.robustService.createDocumentsFromConfig(
      collectionSlug,
      configData,
      count,
      resolveRelationships,
      createMedia
    );

    return {
      content: [
        {
          type: 'text',
          text: `Successfully created ${documents.length} documents in collection **"${collectionSlug}"**:\n\n**Created Documents:**\n${documents.map(d => `- ID: ${d.id}${d.slug ? `, Slug: ${d.slug}` : ''}${d.title ? `, Title: ${d.title}` : ''}`).join('\n')}\n\n**Document Details:**\n\`\`\`json\n${JSON.stringify(documents.map(d => ({ id: d.id, slug: d.slug, title: d.title, createdAt: d.createdAt })), null, 2)}\n\`\`\``,
        },
      ],
    };
  }

  private async handleValidateConfigStructure(args: any) {
    const { configData, type, strict = false } = args;
    
    const validation = this.robustService.validateConfigStructure(
      configData,
      type,
      strict
    );

    const statusIcon = validation.valid ? '✅' : '❌';
    const complexityLevel = validation.complexityScore > 20 ? 'High' : validation.complexityScore > 10 ? 'Medium' : 'Low';

    return {
      content: [
        {
          type: 'text',
          text: `${statusIcon} **Configuration Validation Result**\n\n**Status:** ${validation.valid ? 'Valid' : 'Invalid'}\n**Field Count:** ${validation.fieldCount}\n**Complexity:** ${complexityLevel} (${validation.complexityScore})\n\n${validation.issues.length > 0 ? `**Issues:** ❌\n${validation.issues.map(issue => `- ${issue}`).join('\n')}\n\n` : ''}${validation.warnings.length > 0 ? `**Warnings:** ⚠️\n${validation.warnings.map(warning => `- ${warning}`).join('\n')}\n\n` : ''}**Recommendations:**\n${validation.valid ? '- Configuration is ready for sample data generation' : '- Fix the issues above before proceeding'}\n- Use \`generateSampleFromConfig\` to test data generation\n- Review field requirements and validation rules`,
        },
      ],
    };
  }

  private async handleAnalyzeProjectStructure(args: any) {
    const { payloadConfigPath, tsconfigPath, includeUnused = true, generateReport = true } = args;
    
    // Validate paths are absolute as required by MCP best practices
    this.validateAbsolutePath(payloadConfigPath, 'payloadConfigPath');
    if (tsconfigPath) {
      this.validateAbsolutePath(tsconfigPath, 'tsconfigPath');
    }
    
    const analysis = await this.robustService.analyzeProjectStructure(
      payloadConfigPath,
      tsconfigPath,
      includeUnused,
      generateReport
    );

    const relationshipSummary = Array.from(analysis.relationships.entries())
      .map(([collection, deps]) => `- **${collection}** → [${deps.join(', ')}]`)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📊 **Project Structure Analysis**\n\n**Summary:**\n- **Collections:** ${analysis.summary.totalCollections}\n- **Blocks:** ${analysis.summary.totalBlocks}\n- **Total Fields:** ${analysis.summary.totalFields}\n- **Has Relationships:** ${analysis.summary.hasRelationships ? '✅' : '❌'}\n- **Has Blocks:** ${analysis.summary.hasBlocks ? '✅' : '❌'}\n\n${analysis.relationships.size > 0 ? `**Relationships:**\n${relationshipSummary}\n\n` : ''}${includeUnused ? `**Config Files Found:** ${analysis.configFiles.length}\n\n` : ''}${analysis.issues.length > 0 ? `**Issues:** ❌\n${analysis.issues.map(issue => `- ${issue}`).join('\n')}\n\n` : ''}**Next Steps:**\n- Use \`createCompleteDataset\` to populate all collections\n- Review relationship dependencies\n- Validate individual configurations if needed`,
        },
      ],
    };
  }

  private async handleCreateCompleteDataset(args: any) {
    const { 
      payloadConfigPath, 
      tsconfigPath, 
      collectionsToInclude, 
      documentsPerCollection = 3,
      resolveAllRelationships = true,
      createMediaAssets = false,
      dryRun = false
    } = args;
    
    // Validate paths are absolute as required by MCP best practices
    this.validateAbsolutePath(payloadConfigPath, 'payloadConfigPath');
    if (tsconfigPath) {
      this.validateAbsolutePath(tsconfigPath, 'tsconfigPath');
    }
    
    const result = await this.robustService.createCompleteDataset(
      payloadConfigPath,
      tsconfigPath,
      collectionsToInclude,
      documentsPerCollection,
      resolveAllRelationships,
      createMediaAssets,
      dryRun
    );

    const statusIcon = result.errors.length === 0 ? '✅' : '⚠️';
    const mode = dryRun ? ' (DRY RUN)' : '';

    return {
      content: [
        {
          type: 'text',
          text: `${statusIcon} **Dataset Creation Complete${mode}**\n\n**Summary:**\n- **Collections Processed:** ${result.summary.collectionsProcessed}\n- **Documents Created:** ${result.summary.totalDocuments}\n- **Relationships Resolved:** ${result.summary.relationshipsResolved}\n- **Media Created:** ${result.summary.mediaCreated}\n\n${result.errors.length > 0 ? `**Errors:** ❌\n${result.errors.map(error => `- ${error}`).join('\n')}\n\n` : ''}${dryRun ? '**Note:** This was a dry run. No actual documents were created.\n\n' : ''}**Results:**\n${dryRun ? `Preview of what would be created:\n${result.created.map((item: any) => `- ${item.collection}: ${item.wouldCreate} documents`).join('\n')}` : `Successfully created documents across ${result.summary.collectionsProcessed} collections`}`,
        },
      ],
    };
  }

  private async handleTestPayloadConnection(args: any) {
    const connectionTest = await this.robustService.testConnection();
    
    const statusIcon = connectionTest.connected ? '✅' : '❌';
    const statusText = connectionTest.connected ? 'Connected' : 'Failed';
    
    return {
      content: [
        {
          type: 'text',
          text: `${statusIcon} **PayloadCMS Connection Test**\n\n**Status:** ${statusText}\n\n${connectionTest.connected ? '**Result:** Successfully connected to PayloadCMS instance. Authentication is working correctly.\n\n**Next Steps:**\n- You can now use tools like `createDocumentsFromConfig` and `createCompleteDataset`\n- Use `parsePayloadConfig` to analyze your project structure\n- Try `discoverConfigFiles` to find all configuration files' : `**Error:** ${connectionTest.error}\n\n**Troubleshooting:**\n- Check that PayloadCMS is running and accessible\n- Verify PAYLOAD_HOST is set correctly (e.g., "http://localhost:3000")\n- Ensure authentication credentials are configured:\n  - Either set PAYLOAD_USERNAME and PAYLOAD_PASSWORD\n  - Or set PAYLOAD_API_KEY for API key authentication\n- Check network connectivity to the PayloadCMS instance\n- Verify the PayloadCMS REST API is enabled`}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('PayloadCMS MCP Server (v2.0 - Robust Tools) running on stdio');
  }
}

const server = new PayloadCMSMCPServer();
server.run().catch(console.error); 