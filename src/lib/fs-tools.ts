import * as fs from 'fs';
import * as path from 'path';

export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
}

export interface ProjectStructure {
  projectPath: string;
  configPath?: string;
  tsconfigPath?: string;
  collectionsDir?: string;
  blocksDir?: string;
  globalsDir?: string;
  hasPayloadConfig: boolean;
  directories: string[];
  payloadFiles: string[];
}

export interface SearchResult {
  filePath: string;
  lineNumber: number;
  content: string;
  context: string[];
}

export class FileSystemTools {
  /**
   * List contents of a directory with detailed information
   */
  public listDirectory(dirPath: string, recursive: boolean = false): FileInfo[] {
    if (!this.pathExists(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const items: FileInfo[] = [];
    
    try {
      const entries = fs.readdirSync(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);
        
        const fileInfo: FileInfo = {
          path: fullPath,
          name: entry,
          isDirectory: stats.isDirectory()
        };
        
        if (stats.isFile()) {
          fileInfo.size = stats.size;
        }
        fileInfo.lastModified = stats.mtime;
        
        items.push(fileInfo);
        
        // Recursively list subdirectories if requested
        if (recursive && stats.isDirectory() && !this.shouldSkipDirectory(entry)) {
          const subItems = this.listDirectory(fullPath, true);
          items.push(...subItems);
        }
      }
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return items.sort((a, b) => {
      // Directories first, then files, both alphabetically
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Find files matching specific patterns
   */
  public findFiles(baseDir: string, patterns: RegExp | RegExp[], maxDepth: number = 5): string[] {
    if (!this.pathExists(baseDir)) {
      return [];
    }

    const patternsArray = Array.isArray(patterns) ? patterns : [patterns];
    const foundFiles: string[] = [];
    
    const searchRecursive = (currentDir: string, currentDepth: number) => {
      if (currentDepth > maxDepth) return;
      
      try {
        const entries = fs.readdirSync(currentDir);
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry);
          
          try {
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory() && !this.shouldSkipDirectory(entry)) {
              searchRecursive(fullPath, currentDepth + 1);
            } else if (stats.isFile()) {
              // Check if file matches any pattern
              if (patternsArray.some(pattern => pattern.test(entry) || pattern.test(fullPath))) {
                foundFiles.push(fullPath);
              }
            }
          } catch (statError) {
            // Skip files that can't be accessed
            continue;
          }
        }
      } catch (readError) {
        // Skip directories that can't be read
        return;
      }
    };
    
    searchRecursive(baseDir, 0);
    return foundFiles.sort();
  }

  /**
   * Search for content within files
   */
  public searchInFiles(baseDir: string, searchPattern: string | RegExp, filePattern?: RegExp): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Find files to search in
    const filesToSearch = this.findFiles(
      baseDir, 
      filePattern || /\.(ts|js|tsx|jsx|json)$/,
      5
    );
    
    const regex = typeof searchPattern === 'string' 
      ? new RegExp(searchPattern, 'gi') 
      : searchPattern;
    
    for (const filePath of filesToSearch) {
      try {
        const content = this.readFile(filePath);
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          const matches = line.match(regex);
          
          if (matches) {
            // Get context lines (2 before and 2 after)
            const contextStart = Math.max(0, i - 2);
            const contextEnd = Math.min(lines.length, i + 3);
            const context = lines.slice(contextStart, contextEnd);
            
            results.push({
              filePath,
              lineNumber: i + 1,
              content: line?.trim() || '',
              context
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    return results;
  }

  /**
   * Read file content safely
   */
  public readFile(filePath: string): string {
    if (!this.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if path exists
   */
  public pathExists(targetPath: string): boolean {
    try {
      return fs.existsSync(targetPath);
    } catch {
      return false;
    }
  }

  /**
   * Analyze PayloadCMS project structure
   */
  public analyzeProject(projectPath: string): ProjectStructure {
    const structure: ProjectStructure = {
      projectPath,
      hasPayloadConfig: false,
      directories: [],
      payloadFiles: []
    };

    if (!this.pathExists(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Look for payload.config.ts in common locations
    const configPaths = [
      path.join(projectPath, 'payload.config.ts'),
      path.join(projectPath, 'src', 'payload.config.ts'),
      path.join(projectPath, 'payload.config.js')
    ];

    for (const configPath of configPaths) {
      if (this.pathExists(configPath)) {
        structure.configPath = configPath;
        structure.hasPayloadConfig = true;
        break;
      }
    }

    // Look for tsconfig.json
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    if (this.pathExists(tsconfigPath)) {
      structure.tsconfigPath = tsconfigPath;
    }

    // Analyze directory structure
    const srcDir = path.join(projectPath, 'src');
    if (this.pathExists(srcDir)) {
      const srcContents = this.listDirectory(srcDir);
      
      for (const item of srcContents) {
        if (item.isDirectory) {
          structure.directories.push(item.path);
          
          // Identify PayloadCMS-specific directories
          if (item.name === 'collections') {
            structure.collectionsDir = item.path;
          } else if (item.name === 'blocks') {
            structure.blocksDir = item.path;
          } else if (item.name === 'globals') {
            structure.globalsDir = item.path;
          }
        }
      }
    }

    // Find all PayloadCMS-related files
    const payloadPatterns = [
      /payload\.config\.(ts|js)$/,
      /\/collections\/.*\.(ts|js)$/,
      /\/blocks\/.*\.(ts|js)$/,
      /\/globals\/.*\.(ts|js)$/,
      /\/fields\/.*\.(ts|js)$/
    ];

    structure.payloadFiles = this.findFiles(projectPath, payloadPatterns, 6);

    return structure;
  }

  /**
   * Extract imports from a TypeScript/JavaScript file
   */
  public extractImports(filePath: string): Array<{module: string, imports: string[], isDefault: boolean}> {
    const content = this.readFile(filePath);
    const imports: Array<{module: string, imports: string[], isDefault: boolean}> = [];
    
    // Regex patterns for different import types
    const importPatterns = [
      // import { named } from 'module'
      /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g,
      // import defaultName from 'module' 
      /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"]([^'"]+)['"]/g,
      // import * as name from 'module'
      /import\s*\*\s*as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s*['"]([^'"]+)['"]/g
    ];
    
    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, importedItems, moduleName] = match;
        
        if (!importedItems || !moduleName) continue;
        
        if (pattern.source.includes('\\{')) {
          // Named imports
          const namedImports = importedItems.split(',').map(item => item.trim());
          imports.push({
            module: moduleName,
            imports: namedImports,
            isDefault: false
          });
        } else {
          // Default or namespace import
          imports.push({
            module: moduleName,
            imports: [importedItems],
            isDefault: !pattern.source.includes('\\*')
          });
        }
      }
    }
    
    return imports;
  }

  /**
   * Resolve relative import path to absolute path
   */
  public resolveImportPath(importPath: string, fromFile: string, projectRoot: string): string | null {
    if (!importPath.startsWith('.')) {
      // Not a relative import, skip
      return null;
    }
    
    const fromDir = path.dirname(fromFile);
    const resolvedPath = path.resolve(fromDir, importPath);
    
    // Try common extensions
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];
    
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (this.pathExists(fullPath)) {
        return fullPath;
      }
    }
    
    // Check if it's a directory with index file
    if (this.pathExists(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
      const indexPath = path.join(resolvedPath, 'index.ts');
      if (this.pathExists(indexPath)) {
        return indexPath;
      }
    }
    
    return null;
  }

  /**
   * Get file paths that need to be provided by client for full config parsing
   */
  public getRequiredConfigFiles(structure: ProjectStructure): Array<{path: string, description: string, optional: boolean}> {
    const required: Array<{path: string, description: string, optional: boolean}> = [];
    
    // Always need the main config file
    if (structure.configPath) {
      required.push({
        path: structure.configPath,
        description: 'Main PayloadCMS configuration file',
        optional: false
      });
    }
    
    // Find collection config files
    if (structure.collectionsDir) {
      const collectionFiles = this.findFiles(structure.collectionsDir, [/config\.(ts|js)$/, /index\.(ts|js)$/]);
      for (const file of collectionFiles) {
        required.push({
          path: file,
          description: `Collection configuration: ${path.basename(path.dirname(file))}`,
          optional: true
        });
      }
    }
    
    // Find block config files
    if (structure.blocksDir) {
      const blockFiles = this.findFiles(structure.blocksDir, [/config\.(ts|js)$/, /index\.(ts|js)$/]);
      for (const file of blockFiles) {
        required.push({
          path: file,
          description: `Block configuration: ${path.basename(path.dirname(file))}`,
          optional: true
        });
      }
    }
    
    // Find global config files
    if (structure.globalsDir) {
      const globalFiles = this.findFiles(structure.globalsDir, [/config\.(ts|js)$/, /index\.(ts|js)$/]);
      for (const file of globalFiles) {
        required.push({
          path: file,
          description: `Global configuration: ${path.basename(path.dirname(file))}`,
          optional: true
        });
      }
    }
    
    return required;
  }

  /**
   * Check if directory should be skipped during traversal
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git', 
      '.next',
      'dist',
      'build',
      '.turbo',
      'coverage',
      '.vscode',
      '.idea',
      'tmp',
      'temp'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }
}

export const fsTools = new FileSystemTools();