# PayloadCMS MCP Server Setup Guide

This guide will help you set up and configure the PayloadCMS MCP (Model Context Protocol) server for use with Claude Desktop or other MCP clients.

## Prerequisites

- Node.js >= 18.0.0
- A running PayloadCMS instance
- Claude Desktop app (or another MCP client)

## 1. Installation & Build

```bash
# Clone and navigate to the project
cd payload-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Verify the build
ls dist/
```

## 2. Environment Configuration

Create a `.env` file in the project root:

```bash
# PayloadCMS Configuration
PAYLOAD_URL=http://localhost:3000

# PayloadCMS Authentication (choose ONE method):
# Method 1: API Key (if configured in your PayloadCMS)
PAYLOAD_API_KEY=your-api-key-here

# Method 2: Email/Password Authentication
PAYLOAD_EMAIL=admin@yoursite.com
PAYLOAD_PASSWORD=your-admin-password

# MCP Server Configuration  
MCP_SERVER_NAME=PayloadCMS MCP Server
MCP_SERVER_VERSION=1.0.0
```

## 3. Claude Desktop Configuration

Add the MCP server to your Claude Desktop configuration file:

### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payload-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/payload-mcp/dist/main.js"],
      "env": {
        "PAYLOAD_URL": "http://localhost:3000",
        "PAYLOAD_API_KEY": "your-api-key-here",
        "PAYLOAD_EMAIL": "admin@yoursite.com",
        "PAYLOAD_PASSWORD": "your-admin-password"
      }
    }
  }
}
```

### Windows
Edit `%APPDATA%/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payload-mcp": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\payload-mcp\\dist\\main.js"],
      "env": {
        "PAYLOAD_URL": "http://localhost:3000",
        "PAYLOAD_API_KEY": "your-api-key-here",
        "PAYLOAD_EMAIL": "admin@yoursite.com",
        "PAYLOAD_PASSWORD": "your-admin-password"
      }
    }
  }
}
```

### Linux
Edit `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "payload-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/payload-mcp/dist/main.js"],
      "env": {
        "PAYLOAD_URL": "http://localhost:3000",
        "PAYLOAD_API_KEY": "your-api-key-here",
        "PAYLOAD_EMAIL": "admin@yoursite.com",
        "PAYLOAD_PASSWORD": "your-admin-password"
      }
    }
  }
}
```

## 4. Verify Setup

1. **Restart Claude Desktop** after updating the configuration

2. **Check MCP Server Status** in Claude:
   - Look for the hammer/tools icon in Claude Desktop
   - You should see "PayloadCMS MCP Server" listed as available
   - The tools should include: `bootstrap`, `bootstrap-full`, `get-sample-contents`

3. **Test Connection** (optional):
   ```bash
   # Run the server directly to test
   node dist/main.js
   ```

## 5. PayloadCMS Requirements

Your PayloadCMS instance must be:

- **Running and accessible** at the configured URL
- **Have the following collections** (or compatible ones):
  - `pages` - For website pages
  - `posts` - For blog content  
  - `products` - For e-commerce items
  - `jobs` - For career listings
  - `categories` - For content organization
  - `users` - For user management
  - `testimonials` - For customer reviews
  - `teamMember` - For team information
  - `media` - For file uploads

- **Have proper authentication configured**:
  - **API Key method (recommended)**: Configure API keys in your PayloadCMS admin
  - **Email/Password method**: Use admin credentials (less secure, not recommended for production)

## 6. Usage Examples

Once configured, you can use these prompts in Claude:

### Basic Website Bootstrap
```
Please use the bootstrap tool to create a business website for "Acme Tech Solutions" in the technology industry. Include blog and jobs pages.
```

### Comprehensive Content Generation
```
Use bootstrap-full to generate sample content for all collections in my PayloadCMS project at /Users/myname/projects/my-payload-site
```

### Content Listing
```
Use get-sample-contents to show me all the pages and content in my PayloadCMS project as a CSV export.
```

## 7. Troubleshooting

### Connection Issues
- **Error: "Connection refused"**
  - Verify PayloadCMS is running at the specified URL
  - Check network connectivity
  - Ensure firewall isn't blocking the connection

### Authentication Issues  
- **Error: "Authentication failed"**
  - **If using API Key**: Verify PAYLOAD_API_KEY is correct and configured in PayloadCMS admin
  - **If using Email/Password**: Verify PAYLOAD_EMAIL and PAYLOAD_PASSWORD are correct
  - Ensure the user/API key has proper permissions for all collections
  - Check that authentication method is properly configured in your PayloadCMS instance

### Build Issues
- **TypeScript errors**: Run `npm run type-check`
- **Missing dependencies**: Run `npm install`
- **Permission errors**: Check file permissions and paths

### MCP Client Issues
- **Tools not appearing**: 
  - Restart Claude Desktop
  - Check configuration file syntax (valid JSON)
  - Verify absolute file paths are correct

### Collection Issues
- **Error: "Collection not found"**
  - Verify collection names match your PayloadCMS configuration
  - Check collection permissions
  - Ensure collections are properly configured

## 8. Advanced Configuration

### Custom Collection Mapping
You can customize which collections the tools target by modifying the source code in `src/tools/bootstrap-tools.ts`.

### Custom Content Generation
The content generator can be extended in `src/lib/content-generator.ts` to create industry-specific or custom content.

### API Timeout Configuration
Adjust timeout values in `src/lib/payload-client.ts` for slower connections.

## 9. Security Considerations

- **Never commit secrets**: Keep `.env` files out of version control
- **Use API keys**: Prefer API key authentication over username/password
- **Network security**: Ensure secure connections when accessing remote PayloadCMS instances
- **Access control**: Verify MCP tools have appropriate permissions in PayloadCMS

## 10. PayloadCMS API Key Configuration (Recommended)

To set up API key authentication in PayloadCMS:

1. **Enable API Keys in your PayloadCMS config**:
   ```typescript
   // In your payload.config.ts
   export default buildConfig({
     // ... other config
     collections: [
       // ... your collections
       {
         slug: 'api-keys',
         auth: {
           useAPIKey: true,
         },
         // ... other config
       }
     ]
   })
   ```

2. **Create an API Key in PayloadCMS Admin**:
   - Log into your PayloadCMS admin panel
   - Navigate to API Keys collection (if configured)
   - Create a new API key with appropriate permissions
   - Copy the generated key for use in your environment variables

3. **Alternative**: Use the PayloadCMS Local API for server-side authentication without REST API keys.

## 11. Placeholder Media

The MCP server includes a placeholder image (`public/placeholder-image.png`) that will be automatically uploaded to your PayloadCMS media collection when using tools with media creation enabled:

- **bootstrap**: Always uploads one placeholder image
- **bootstrap-full**: Uploads multiple placeholder images when `uploadPlaceholderMedia: true`

The placeholder image will be:
- Uploaded as actual file to your PayloadCMS media collection
- Referenced in content that requires images (hero backgrounds, etc.)
- Used for testing upload functionality and media relationships

## 12. Support

For issues and questions:
- Check the troubleshooting section above
- Review PayloadCMS documentation for collection and API setup
- Verify your environment configuration matches the requirements

## Quick Start Summary

1. Build: `npm run build`
2. Configure Claude Desktop with absolute path to `dist/main.js`
3. Set environment variables for PayloadCMS connection
4. Restart Claude Desktop
5. Test with a simple bootstrap command

That's it! You should now be able to use the PayloadCMS MCP tools within Claude Desktop.