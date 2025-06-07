/**
 * Debug Media Upload Test Script
 * 
 * This script tests the complete media upload flow to identify and fix issues
 */

import { PayloadCMSClient } from '../src/lib/payload-client.js';
import { uploadPlaceholderImage, uploadMainPlaceholderImage, placeholderImageExists, getPlaceholderImagePath } from '../src/utils/media-upload.js';
import { logger } from '../src/utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration
const testConfig = {
  host: process.env['PAYLOAD_HOST'] || process.env['PAYLOAD_URL'] || 'http://localhost:3000',
  apiKey: process.env['PAYLOAD_API_KEY'],
  email: process.env['PAYLOAD_USERNAME'] || process.env['PAYLOAD_EMAIL'],
  password: process.env['PAYLOAD_PASSWORD']
};

async function debugMediaUpload() {
  console.log('🔍 Starting Media Upload Debug Tests...\n');

  // Test 1: Environment Configuration
  console.log('1. Testing Environment Configuration:');
  console.log(`   - Host: ${testConfig.host}`);
  console.log(`   - Has API Key: ${!!testConfig.apiKey}`);
  console.log(`   - Has Email: ${!!testConfig.email}`);
  console.log(`   - Has Password: ${!!testConfig.password}`);
  
  if (!testConfig.email || !testConfig.password) {
    console.error('❌ Missing email/password credentials');
    return;
  }
  console.log('✅ Environment configuration OK\n');

  // Test 2: Placeholder Image Exists
  console.log('2. Testing Placeholder Image Existence:');
  const imageExists = placeholderImageExists();
  const imagePath = getPlaceholderImagePath();
  console.log(`   - Image Path: ${imagePath}`);
  console.log(`   - Image Exists: ${imageExists}`);
  
  if (!imageExists) {
    console.error('❌ Placeholder image not found');
    return;
  }
  
  const imageStats = fs.statSync(imagePath);
  console.log(`   - Image Size: ${imageStats.size} bytes`);
  console.log('✅ Placeholder image exists\n');

  // Test 3: PayloadCMS Client Connection
  console.log('3. Testing PayloadCMS Client Connection:');
  const client = new PayloadCMSClient(testConfig);
  
  try {
    console.log('   - Initializing client...');
    await client.initialize();
    console.log('✅ PayloadCMS client initialized successfully');
    
    console.log('   - Testing ping...');
    const canPing = await client.ping();
    console.log(`   - Ping result: ${canPing}`);
    
    if (!canPing) {
      console.warn('⚠️  Ping failed, but continuing with upload test');
    }
  } catch (error) {
    console.error('❌ Failed to initialize PayloadCMS client:', error);
    return;
  }
  console.log('✅ PayloadCMS connection OK\n');

  // Test 4: Direct File Upload Test
  console.log('4. Testing Direct File Upload:');
  try {
    console.log('   - Reading placeholder image...');
    const imageBuffer = fs.readFileSync(imagePath);
    console.log(`   - Image buffer size: ${imageBuffer.length} bytes`);
    
    console.log('   - Attempting direct upload...');
    const uploadResult = await client.uploadFile(
      imageBuffer,
      'test-placeholder.png',
      'image/png',
      'media'
    );
    
    console.log('✅ Direct upload successful:', {
      id: uploadResult.id,
      filename: uploadResult['filename'] || 'unknown',
      url: uploadResult['url'] || 'no url'
    });
  } catch (error) {
    console.error('❌ Direct upload failed:', error);
    console.error('   Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
  }
  console.log();

  // Test 5: Upload Helper Function Test
  console.log('5. Testing Upload Helper Functions:');
  try {
    console.log('   - Testing uploadPlaceholderImage()...');
    const helperResult = await uploadPlaceholderImage(client, 'test-helper');
    
    console.log('✅ Helper upload successful:', {
      id: helperResult.id,
      filename: helperResult.filename,
      alt: helperResult.alt,
      url: helperResult.url || 'no url'
    });
  } catch (error) {
    console.error('❌ Helper upload failed:', error);
    console.error('   Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
  }
  console.log();

  // Test 6: Main Upload Function Test
  console.log('6. Testing Main Upload Function:');
  try {
    console.log('   - Testing uploadMainPlaceholderImage()...');
    const mainResult = await uploadMainPlaceholderImage(client, 'main-test.png');
    
    console.log('✅ Main upload successful:', {
      id: mainResult.id,
      filename: mainResult.filename,
      alt: mainResult.alt,
      url: mainResult.url || 'no url'
    });
  } catch (error) {
    console.error('❌ Main upload failed:', error);
    console.error('   Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
  }
  console.log();

  // Test 7: List Media Collection
  console.log('7. Testing Media Collection Access:');
  try {
    console.log('   - Fetching media documents...');
    const mediaList = await client.find('media', { limit: 5 });
    
    console.log('✅ Media collection accessible:');
    console.log(`   - Total documents: ${mediaList.totalDocs}`);
    console.log('   - Recent uploads:');
    
    mediaList.docs.forEach((doc, index) => {
      console.log(`     ${index + 1}. ID: ${doc.id}, Filename: ${doc['filename'] || 'unknown'}`);
    });
  } catch (error) {
    console.error('❌ Failed to access media collection:', error);
  }
  console.log();

  console.log('🏁 Media Upload Debug Test Complete');
}

// Test Path Resolution Issues
async function testPathResolution() {
  console.log('\n🔍 Testing Path Resolution Issues...\n');

  console.log('1. Current Working Directory:', process.cwd());
  console.log('2. Script Directory (import.meta.url):', path.dirname(new URL(import.meta.url).pathname));
  
  // Test different path resolution methods
  const methods = [
    {
      name: 'Current method (__dirname alternative)',
      path: path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public', 'placeholder-image.png')
    },
    {
      name: 'From process.cwd()',
      path: path.resolve(process.cwd(), 'public', 'placeholder-image.png')
    },
    {
      name: 'Relative to src/',
      path: path.resolve(path.dirname(new URL(import.meta.url).pathname), '../src/../public', 'placeholder-image.png')
    }
  ];

  methods.forEach((method, index) => {
    console.log(`${index + 1}. ${method.name}:`);
    console.log(`   Path: ${method.path}`);
    console.log(`   Exists: ${fs.existsSync(method.path)}`);
    if (fs.existsSync(method.path)) {
      const stats = fs.statSync(method.path);
      console.log(`   Size: ${stats.size} bytes`);
    }
    console.log();
  });
}

// Run the tests
async function main() {
  try {
    await testPathResolution();
    await debugMediaUpload();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { debugMediaUpload, testPathResolution };