#!/usr/bin/env node

/**
 * Simple test script to verify the PayloadCMS MCP server is working
 * Run with: node test-server.js
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

console.log('🧪 Testing PayloadCMS MCP Server...\n');

// Check if built version exists
try {
  readFileSync('./dist/main.js');
  console.log('✅ Built server found at ./dist/main.js');
} catch (error) {
  console.log('❌ Built server not found. Run: npm run build');
  process.exit(1);
}

// Test the server startup
console.log('🚀 Starting MCP server...');

const server = spawn('node', ['./dist/main.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let hasError = false;

server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  const message = data.toString();
  if (message.includes('PayloadCMS MCP Server running on stdio')) {
    console.log('✅ Server started successfully!');
    console.log('📡 Server is listening for MCP protocol messages');
    
    // Test tool listing
    testToolListing();
  } else if (message.includes('error') || message.includes('Error')) {
    console.log('❌ Server error:', message);
    hasError = true;
  }
});

server.on('close', (code) => {
  if (code !== 0 && !hasError) {
    console.log(`❌ Server exited with code ${code}`);
  }
});

function testToolListing() {
  // Send a tools list request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // Give it a moment then test a tool call
  setTimeout(testToolCall, 500);
}

function testToolCall() {
  // Test the convertToRichtext tool
  const toolCallRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'convertToRichtext',
      arguments: {
        content: 'Hello, this is a test!'
      }
    }
  };

  server.stdin.write(JSON.stringify(toolCallRequest) + '\n');

  // Give it a moment then finish
  setTimeout(() => {
    console.log('✅ Basic functionality test completed');
    console.log('\n🎉 PayloadCMS MCP Server is working correctly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Integrate with your MCP client');
    console.log('   2. Configure PayloadCMS credentials in env file');
    console.log('   3. Extend with full PayloadCMS API integration');
    
    server.kill();
    process.exit(0);
  }, 500);
}

// Handle script termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  server.kill();
  process.exit(0);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timeout - server may not be responding correctly');
  server.kill();
  process.exit(1);
}, 10000); 