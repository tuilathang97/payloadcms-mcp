#!/usr/bin/env node

import { config } from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Load environment variables
config();

// Tool definitions
const tools = [
  {
    name: 'createBlockSampleContent',
    description: 'Generate sample content for PayloadCMS block configurations',
    inputSchema: {
      type: 'object',
      properties: {
        blockSlug: { 
          type: 'string', 
          description: 'The block type identifier' 
        },
        collectionSlug: { 
          type: 'string', 
          description: 'The collection containing the block' 
        },
        variations: { 
          type: 'number', 
          description: 'Number of content variations to generate',
          default: 1 
        },
        includeOptional: { 
          type: 'boolean', 
          description: 'Include optional fields',
          default: true 
        },
        locale: { 
          type: 'string', 
          description: 'Content locale',
          default: 'en' 
        }
      },
      required: ['blockSlug', 'collectionSlug']
    }
  },
  {
    name: 'createCollectionSampleContent',
    description: 'Generate complete sample documents for PayloadCMS collections',
    inputSchema: {
      type: 'object',
      properties: {
        collectionSlug: { 
          type: 'string', 
          description: 'The collection identifier' 
        },
        count: { 
          type: 'number', 
          description: 'Number of documents to create',
          default: 3 
        },
        includeOptional: { 
          type: 'boolean', 
          description: 'Include optional fields',
          default: true 
        },
        locale: { 
          type: 'string', 
          description: 'Content locale',
          default: 'en' 
        }
      },
      required: ['collectionSlug']
    }
  },
  {
    name: 'getSampleContent',
    description: 'Query existing collections and blocks to understand data structure',
    inputSchema: {
      type: 'object',
      properties: {
        collectionSlug: { 
          type: 'string', 
          description: 'Specific collection to query' 
        },
        limit: { 
          type: 'number', 
          description: 'Maximum results to return',
          default: 10 
        },
        fields: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific fields to include' 
        }
      }
    }
  },
  {
    name: 'createRelationalContent',
    description: 'Create content with automatic dependency resolution',
    inputSchema: {
      type: 'object',
      properties: {
        targetCollection: { 
          type: 'string', 
          description: 'Main collection to create content for' 
        },
        count: { 
          type: 'number', 
          description: 'Number of documents to create',
          default: 1 
        },
        createDependencies: { 
          type: 'boolean', 
          description: 'Auto-create related content',
          default: true 
        },
        dependencyDepth: { 
          type: 'number', 
          description: 'Maximum relationship depth',
          default: 3 
        }
      },
      required: ['targetCollection']
    }
  },
  {
    name: 'convertToRichtext',
    description: 'Convert plain text, HTML, or markdown to Lexical rich text format',
    inputSchema: {
      type: 'object',
      properties: {
        content: { 
          type: 'string', 
          description: 'Content to convert' 
        },
        format: { 
          type: 'string', 
          enum: ['plaintext', 'html', 'markdown'],
          description: 'Input format',
          default: 'plaintext' 
        }
      },
      required: ['content']
    }
  }
];

class PayloadCMSMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: process.env['MCP_SERVER_NAME'] || 'PayloadCMS MCP Server',
        version: process.env['MCP_SERVER_VERSION'] || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'createBlockSampleContent':
            return await this.handleCreateBlockSampleContent(args);
          
          case 'createCollectionSampleContent':
            return await this.handleCreateCollectionSampleContent(args);
          
          case 'getSampleContent':
            return await this.handleGetSampleContent(args);
          
          case 'createRelationalContent':
            return await this.handleCreateRelationalContent(args);
          
          case 'convertToRichtext':
            return await this.handleConvertToRichtext(args);
          
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

  private async handleCreateBlockSampleContent(args: any) {
    const { blockSlug, collectionSlug, variations = 1 } = args;
    
    // Placeholder implementation
    const sampleData = {
      blockType: blockSlug,
      content: `Sample content for ${blockSlug} block in ${collectionSlug} collection`,
      generated: new Date().toISOString(),
      variations: variations
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleCreateCollectionSampleContent(args: any) {
    const { collectionSlug, count = 3 } = args;
    
    // Placeholder implementation
    const sampleData = {
      collection: collectionSlug,
      documentsCreated: count,
      sampleDocument: {
        id: 'sample-id-123',
        title: `Sample ${collectionSlug} document`,
        createdAt: new Date().toISOString(),
        content: `This is sample content for the ${collectionSlug} collection`
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleGetSampleContent(args: any) {
    const { collectionSlug, limit = 10 } = args;
    
    // Placeholder implementation
    const sampleData = {
      collection: collectionSlug || 'all',
      limit: limit,
      message: 'This is a placeholder. Connect to your PayloadCMS instance to get real data.',
      sampleStructure: {
        docs: [],
        totalDocs: 0,
        totalPages: 0
      }
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleCreateRelationalContent(args: any) {
    const { targetCollection, count = 1, createDependencies = true } = args;
    
    // Placeholder implementation
    const sampleData = {
      targetCollection: targetCollection,
      documentsCreated: count,
      dependenciesCreated: createDependencies,
      message: 'Relational content creation placeholder. Implement with PayloadCMS integration.'
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(sampleData, null, 2),
        },
      ],
    };
  }

  private async handleConvertToRichtext(args: any) {
    const { content } = args;
    
    // Simple Lexical conversion placeholder
    const lexicalContent = {
      root: {
        children: [
          {
            children: [
              {
                text: content,
                type: 'text',
                version: 1,
                format: 0,
                mode: 'normal',
                style: '',
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(lexicalContent, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('PayloadCMS MCP Server running on stdio');
  }
}

// Start the server
const server = new PayloadCMSMCPServer();
server.run().catch((error) => {
  console.error('Failed to run server:', error);
  process.exit(1);
}); 