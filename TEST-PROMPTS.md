# PayloadCMS MCP Server Test Prompts

Use these prompts to thoroughly test the PayloadCMS MCP server functionality. Each section tests different aspects of the tools.

## 🚀 Basic Functionality Tests

### 1. Simple Bootstrap Test
```
Use the bootstrap tool to create a basic business website for "Test Company" in the "Software" industry. Don't include e-commerce or jobs, but include a blog.
```

**Expected Result:**
- Success response with `websiteType: "business"`
- 8-10 pages created (Home, About, Services, Contact, Blog, Privacy, Terms, FAQ, Search)
- Supporting content created (posts, testimonials, team members, categories)
- Execution time reported

### 2. E-commerce Bootstrap Test
```
Bootstrap an e-commerce website for "Demo Store" in the "Retail" industry. Include e-commerce features but exclude jobs and blog.
```

**Expected Result:**
- `websiteType: "ecommerce"` 
- Products page included
- E-commerce specific content
- No blog or careers pages

### 3. Full Content Generation Test
```
Use bootstrap-full to generate comprehensive sample content for all collections. Set blocksPerCollection to 2 and include all layout variations.
```

**Expected Result:**
- All 9 collections processed
- Multiple layout variations for pages
- Block types tracked and reported
- Performance metrics included

## 🎯 Advanced Feature Tests

### 4. Content Quality Test
```
Create a high-quality business website for "Premium Consulting" using bootstrap with contentQuality set to "high" and enable relationship resolution.
```

**Expected Result:**
- Higher quality content generation
- Relationships properly resolved
- Industry-specific content for consulting

### 5. Custom Business Info Test
```
Bootstrap a healthcare website with these business details:
- Name: "Healthy Life Medical Center"
- Industry: "Healthcare" 
- Description: "Comprehensive medical services for families"
Include jobs and blog sections.
```

**Expected Result:**
- Content tailored to healthcare industry
- Medical terminology and context
- Appropriate service descriptions

### 6. Blog-Focused Website Test
```
Create a blog-focused website using bootstrap with websiteType "blog", including blog but excluding e-commerce and jobs.
```

**Expected Result:**
- Blog-optimized structure
- Multiple blog posts created
- Content categories established

## 📊 Content Listing & Export Tests

### 7. Basic Content Listing
```
Use get-sample-contents to show me all the content created in my PayloadCMS project. Group results by collection.
```

**Expected Result:**
- All collections listed with their documents
- Proper URL generation for each item
- Correct grouping by collection type

### 8. Filtered Content Listing
```
Get sample contents for only "pages" and "posts" collections, and export the results in CSV format.
```

**Expected Result:**
- Only pages and posts shown
- CSV formatted output
- Proper headers and data rows

### 9. Sitemap Generation Test
```
Generate a sitemap for all my content using get-sample-contents with format set to "sitemap".
```

**Expected Result:**
- Valid XML sitemap structure
- All URLs properly formatted
- Correct sitemap headers and structure

## 🔧 Error Handling Tests

### 10. Invalid Project Path Test
```
Try to bootstrap a website using an invalid project path: "/this/path/does/not/exist"
```

**Expected Result:**
- Error response with `success: false`
- Clear error message about invalid path
- Helpful suggestion for resolution

### 11. Unsupported Website Type Test
```
Bootstrap a website with websiteType set to "unsupported-type".
```

**Expected Result:**
- Error response listing supported types
- Clear validation message
- List of valid website types

### 12. Invalid Collection Test
```
Use bootstrap-full with collections set to ["invalid-collection", "another-invalid"].
```

**Expected Result:**
- Error response with invalid collection names
- List of available collections
- Clear validation failure message

## 🎨 Layout & Design Tests

### 13. All Layout Variations Test
```
Use bootstrap-full with includeAllLayoutVariations set to true and focus on pages collection to test all block layouts.
```

**Expected Result:**
- Multiple layout variations created
- Different block types documented
- Layout-specific content generated

### 14. Custom URL Patterns Test
```
Use get-sample-contents with custom URL patterns: posts should use "blog/{slug}" and products should use "shop/{slug}".
```

**Expected Result:**
- URLs formatted according to custom patterns
- Proper slug replacement
- Consistent URL structure

### 15. Media Handling Test
```
Bootstrap-full with uploadPlaceholderMedia set to true and validate that media references are created.
```

**Expected Result:**
- Actual placeholder image files uploaded from `public/placeholder-image.png`
- Media properly linked to content (e.g., hero background images)
- Media field types documented
- Multiple placeholder images created with unique filenames

## 🚀 Performance & Scale Tests

### 16. Large Scale Generation Test
```
Use bootstrap-full to create 5 documents per collection for all collections. Enable relationship resolution and media creation.
```

**Expected Result:**
- Performance metrics under 60 seconds
- All relationships properly resolved
- No memory issues or timeouts

### 17. Error Recovery Test
```
Bootstrap-full with continueOnError set to true to test partial failure handling.
```

**Expected Result:**
- Continues processing despite some failures
- Detailed failure reporting
- Successful operations documented

### 18. Relationship Complexity Test
```
Create a complex website with bootstrap that includes all content types, then use get-sample-contents to verify all relationships are properly formed.
```

**Expected Result:**
- Complex relationship chains created
- No orphaned content
- Proper relationship validation

## 🔍 Validation & Quality Tests

### 19. Content Quality Validation
```
Use bootstrap-full with contextualContent and validateLexicalContent both set to true.
```

**Expected Result:**
- Contextually appropriate content
- Valid Lexical rich text format
- Content quality metrics reported

### 20. Configuration Discovery Test
```
Bootstrap-full with autoDiscoverCollections set to true to test configuration parsing.
```

**Expected Result:**
- All collections automatically discovered
- Configuration validation passed
- Available blocks properly identified

## 📱 Integration Tests

### 21. Full Website Creation Flow
```
Create a complete technology startup website for "InnovateTech AI" that includes:
1. Bootstrap the main website with blog and jobs
2. Generate full content with bootstrap-full 
3. Export all content as a sitemap
Test this as a complete workflow.
```

**Expected Result:**
- Complete website successfully created
- All content properly generated
- Sitemap export works correctly

### 22. Multi-Industry Test
```
Test content generation for different industries by bootstrapping websites for:
- Healthcare: "City Medical Center"
- Technology: "DevTools Pro"  
- Education: "Learning Academy"
Compare how content differs across industries.
```

**Expected Result:**
- Industry-specific content generated
- Appropriate terminology for each sector
- Relevant service offerings

### 23. Content Consistency Test
```
Bootstrap a website, then use get-sample-contents to list all content, then bootstrap-full to add more content, and finally list contents again to verify consistency.
```

**Expected Result:**
- Content properly incremented
- No duplicate or conflicting data
- Consistent URL patterns maintained

## ⚡ Edge Case Tests

### 24. Empty Configuration Test
```
Try bootstrap with minimal configuration - only projectPath provided.
```

**Expected Result:**
- Uses sensible defaults
- Creates basic business website
- No critical errors

### 25. Special Characters Test
```
Bootstrap a website for "Café & Restaurant München" with special characters in the business name.
```

**Expected Result:**
- Special characters properly handled
- Valid URLs generated (slug formatting)
- Content properly encoded

### 26. Large Content Test
```
Bootstrap-full with blocksPerCollection set to the maximum (10) for stress testing.
```

**Expected Result:**
- Handles large content generation
- Memory usage remains reasonable
- Performance metrics within acceptable limits

### 27. Placeholder Image Upload Test
```
Test the placeholder image functionality by running bootstrap for "Test Studio" with media creation, then check that the actual placeholder-image.png file was uploaded to PayloadCMS media collection.
```

**Expected Result:**
- `public/placeholder-image.png` file successfully uploaded
- Media document created in PayloadCMS with proper metadata
- Image accessible via PayloadCMS media collection
- Media referenced in generated content (e.g., hero background)

## 🎯 Manual Verification Checklist

After running the automated tests, manually verify:

- [ ] All generated URLs are valid and follow expected patterns
- [ ] Content quality is appropriate for the specified industries
- [ ] Rich text content displays properly in PayloadCMS admin
- [ ] Media references work correctly
- [ ] Relationships between content are logical
- [ ] Performance is acceptable for production use
- [ ] Error messages are helpful and actionable
- [ ] Export formats (CSV, XML) are properly structured

## 🐛 Common Issues to Watch For

1. **Memory Usage**: Monitor memory consumption during large content generation
2. **Database Connections**: Ensure proper connection pooling and cleanup
3. **Timeout Handling**: Verify timeouts work correctly for slow operations
4. **Content Validation**: Check that generated content passes PayloadCMS validation
5. **URL Encoding**: Ensure special characters in URLs are properly encoded
6. **Relationship Integrity**: Verify all relationship references are valid

## 📈 Success Criteria

A successful test run should achieve:
- ✅ All basic functionality tests pass
- ✅ Error handling works as expected  
- ✅ Performance meets requirements (< 60s for large operations)
- ✅ Content quality is appropriate
- ✅ Export formats are valid
- ✅ No memory leaks or connection issues
- ✅ All edge cases handled gracefully

Use these prompts systematically to ensure comprehensive testing coverage of the PayloadCMS MCP server functionality.