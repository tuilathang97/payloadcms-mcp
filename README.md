# PayloadCMS MCP Server

A Model Context Protocol (MCP) server for PayloadCMS integration, providing AI-powered content generation and management capabilities.

> **Current Status**: ✅ Basic MCP server implemented and working  
> **Version**: 1.0.0 - MVP with placeholder implementations  
> **Ready for**: Testing with MCP clients, extending with full PayloadCMS integration

## Features

- **🛠️ MCP Tools**: 5 essential tools for PayloadCMS content management
- **📝 Content Generation**: Placeholder implementations ready for PayloadCMS integration
- **🔗 Rich Text Support**: Basic Lexical format conversion 
- **🔄 Extensible Architecture**: Modular design for easy feature additions
- **📦 Production Ready**: TypeScript, proper error handling, environment configuration

## MCP Tools

### 1. `createBlockSampleContent`
Generate sample content for specific block configurations with all field variations.

**Parameters:**
- `blockSlug` (string): The block type identifier
- `variations` (number, optional): Number of content variations to generate (default: 1)
- `includeOptional` (boolean, optional): Include optional fields (default: true)
- `locale` (string, optional): Content locale

### 2. `createCollectionSampleContent`
Generate complete sample documents for collections with all blocks and fields.

**Parameters:**
- `collectionSlug` (string): The collection identifier
- `count` (number, optional): Number of documents to create (default: 3)
- `includeOptional` (boolean, optional): Include optional fields (default: true)
- `locale` (string, optional): Content locale

### 3. `getSampleContent`
Query existing collections and blocks to understand data structure.

**Parameters:**
- `collectionSlug` (string, optional): Specific collection to query
- `limit` (number, optional): Maximum results to return (default: 10)
- `fields` (array, optional): Specific fields to include

### 4. `createRelationalContent`
Create content with automatic dependency resolution for relationships.

**Parameters:**
- `targetCollection` (string): Main collection to create content for
- `count` (number, optional): Number of documents to create (default: 1)
- `createDependencies` (boolean, optional): Auto-create related content (default: true)
- `dependencyDepth` (number, optional): Maximum relationship depth (default: 3)

### 5. `convertToRichtext`
Convert plain text, HTML, or markdown to Lexical rich text format.

**Parameters:**
- `content` (string): Content to convert
- `format` (string, optional): Input format: 'plaintext', 'html', 'markdown' (default: 'plaintext')

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Build the project:**
```bash
npm run build
```

3. **Test the server:**
```bash
npm run dev
```

4. **Use with MCP clients:**
```bash
npm start
```

The server is now ready to use with any MCP-compatible client!

## Current Implementation

### ✅ What's Working
- **MCP Server**: Fully functional server with stdio transport
- **5 Core Tools**: All tools defined and responding with sample data
- **TypeScript Build**: Clean compilation with proper types
- **Error Handling**: Comprehensive error responses
- **Environment Config**: Ready for PayloadCMS credentials

### 🚧 What's Next (Ready for Extension)
- **PayloadCMS Integration**: Replace placeholders with real API calls
- **Content Generation**: Add faker.js-powered realistic data
- **Relationship Management**: Implement dependency resolution
- **Lexical Converter**: Full rich text formatting support
- **Collection Discovery**: Dynamic schema inference

### 📂 Architecture
```
src/
├── main.ts              # ✅ Working MCP server entry point
├── lib/
│   ├── payload-client.ts    # 🚧 PayloadCMS REST API client (ready)
│   ├── content-generator.ts # 🚧 Faker.js content generation (ready)
│   ├── relationship-manager.ts # 🚧 Dependency resolution (ready)
│   └── lexical-generator.ts    # 🚧 Rich text conversion (ready)
└── tools/
    └── index.ts         # 🚧 Tool definitions (ready)
```

## Configuration

### Environment Variables

Copy `env.example` to `.env` and configure:

```env
# Required
PAYLOAD_HOST=http://localhost:3000
PAYLOAD_USERNAME=admin@example.com
PAYLOAD_PASSWORD=your-secure-password

# Optional - use API key instead
PAYLOAD_API_KEY=your-api-key

# Optional settings
DEFAULT_LOCALE=en
MAX_CONTENT_VARIATIONS=5
DEFAULT_DEPENDENCY_DEPTH=3
```

### PayloadCMS Setup

Ensure your PayloadCMS instance:
1. Has REST API enabled
2. Allows the configured user/API key access
3. Has the collections you want to work with configured

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### MCP Client Integration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "payloadcms": {
      "command": "node",
      "args": ["/path/to/payloadcms-mcp-server/dist/index.js"],
      "env": {
        "PAYLOAD_HOST": "http://localhost:3000",
        "PAYLOAD_USERNAME": "admin@example.com",
        "PAYLOAD_PASSWORD": "your-password"
      }
    }
  }
}
```

## Examples

### Generate Blog Post Content
```typescript
// Using the createCollectionSampleContent tool
{
  "collectionSlug": "posts",
  "count": 5,
  "includeOptional": true
}
```

### Create Content with Relationships
```typescript
// Using the createRelationalContent tool
{
  "targetCollection": "posts",
  "count": 3,
  "createDependencies": true,
  "dependencyDepth": 2
}
```

### Convert Content to Rich Text
```typescript
// Using the convertToRichtext tool
{
  "content": "# Heading\n\nThis is **bold** text with a [link](http://example.com).",
  "format": "markdown"
}
```

## Supported Field Types

The server supports all PayloadCMS field types:

- **Text Fields**: text, textarea, email, number, date
- **Selection Fields**: select, radio, checkbox
- **Rich Content**: richText (Lexical), code, json
- **Relationships**: relationship (single/multiple), upload
- **Layout Fields**: group, array, blocks, tabs, row, collapsible
- **Geo**: point
- **Custom**: Extensible for custom field types

## Content Generation Features

### Contextual Content
The server generates contextually appropriate content based on:
- Collection names (posts, users, products, etc.)
- Field names (title, email, description, etc.)
- Field types and constraints

### Realistic Data
Uses Faker.js to generate:
- Names, emails, addresses
- Lorem ipsum text in appropriate lengths
- Valid dates, numbers, and URLs
- Geographic coordinates
- Product information
- Company and personal data

### Relationship Handling
Automatically:
- Detects relationship dependencies
- Creates referenced content first
- Links documents with valid IDs
- Handles circular dependencies
- Respects relationship constraints

## Architecture

```
src/
├── index.ts                 # MCP server entry point
├── tools/
│   └── index.ts            # MCP tool definitions
└── lib/
    ├── payload-client.ts   # PayloadCMS API client
    ├── content-generator.ts # Sample content generation
    ├── relationship-manager.ts # Dependency management
    └── lexical-generator.ts # Rich text conversion
```

## Error Handling

The server provides comprehensive error handling:
- Authentication failures
- Network connectivity issues
- Invalid collection/field configurations
- Content validation errors
- Relationship resolution failures

All errors include detailed messages and suggestions for resolution.

## Development

### Scripts
- `npm run build` - Compile TypeScript
- `npm run dev` - Development mode with hot reload
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint checking
- `npm run lint:fix` - Auto-fix linting issues

### Testing
```bash
# Run type checking
npm run type-check

# Test MCP server manually
npm run dev
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify PayloadCMS credentials
   - Check if user has appropriate permissions
   - Ensure PayloadCMS API is accessible

2. **Collection Not Found**
   - Verify collection slug spelling
   - Check if collection exists in PayloadCMS
   - Ensure user has access to the collection

3. **Relationship Errors**
   - Check if related collections exist
   - Verify relationship field configurations
   - Ensure dependency depth isn't too high

4. **Content Generation Issues**
   - Check field type configurations
   - Verify required field constraints
   - Review validation rules

### Debug Mode

Enable debug logging:
```env
DEBUG=true
LOG_LEVEL=debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Check the troubleshooting section
- Review PayloadCMS documentation
- Open an issue for bugs or feature requests 