import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface PayloadField {
  name: string;
  type: string;
  required?: boolean;
  options?: any[];
  relationTo?: string | string[];
  hasMany?: boolean;
  admin?: any;
  fields?: PayloadField[];
  blocks?: string[] | PayloadBlock[];
  tabs?: PayloadTab[];
  maxRows?: number;
  minRows?: number;
  [key: string]: any;
}

export interface PayloadTab {
  label: string;
  fields: PayloadField[];
}

export interface PayloadBlock {
  slug: string;
  fields: PayloadField[];
  labels?: {
    singular?: string;
    plural?: string;
  };
}

export interface PayloadCollection {
  slug: string;
  fields: PayloadField[];
  labels?: {
    singular?: string;
    plural?: string;
  };
}

export interface PayloadConfig {
  collections: PayloadCollection[];
  blocks: PayloadBlock[];
  globals?: any[];
}

export class ConfigParser {
  private configPath: string;
  private tsconfigPath: string | undefined;
  private compilerOptions: ts.CompilerOptions;
  private blockCache: Map<string, PayloadBlock> = new Map();

  constructor(configPath: string, tsconfigPath?: string) {
    this.configPath = configPath;
    this.tsconfigPath = tsconfigPath;
    this.compilerOptions = this.loadCompilerOptions();
  }

  private loadCompilerOptions(): ts.CompilerOptions {
    if (this.tsconfigPath && fs.existsSync(this.tsconfigPath)) {
      const configFile = ts.readConfigFile(this.tsconfigPath, ts.sys.readFile);
      if (configFile.config) {
        const parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(this.tsconfigPath)
        );
        return parsedConfig.options;
      }
    }

    // Default TypeScript options
    return {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    };
  }

  /**
   * Parse the main payload.config.ts file to get collections and blocks
   */
  public async parsePayloadConfig(): Promise<PayloadConfig> {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`Payload config file not found: ${this.configPath}`);
    }

    const sourceFile = this.createSourceFile(this.configPath);
    const payloadConfig: PayloadConfig = {
      collections: [],
      blocks: [],
      globals: []
    };

    // Find the default export or buildConfig call
    const configObject = this.findConfigObject(sourceFile);
    
    if (configObject) {
      // Extract collections
      const collectionsProperty = this.findProperty(configObject, 'collections');
      if (collectionsProperty && ts.isArrayLiteralExpression(collectionsProperty)) {
        for (const element of collectionsProperty.elements) {
          const collection = await this.parseCollectionReference(element, path.dirname(this.configPath));
          if (collection) {
            payloadConfig.collections.push(collection);
          }
        }
      }

      // Extract blocks (if they exist at top level)
      const blocksProperty = this.findProperty(configObject, 'blocks');
      if (blocksProperty && ts.isArrayLiteralExpression(blocksProperty)) {
        for (const element of blocksProperty.elements) {
          const block = await this.parseBlockReference(element, path.dirname(this.configPath));
          if (block) {
            payloadConfig.blocks.push(block);
          }
        }
      }
    }

    return payloadConfig;
  }

  /**
   * Parse a specific collection config file
   */
  public async parseCollectionConfig(configFilePath: string): Promise<PayloadCollection | null> {
    if (!fs.existsSync(configFilePath)) {
      return null;
    }

    const sourceFile = this.createSourceFile(configFilePath);
    const imports = this.parseImports(sourceFile);
    
    // Find the collection export
    const collectionExport = this.findCollectionExport(sourceFile);
    if (collectionExport) {
      return await this.parseCollectionObject(collectionExport, path.dirname(configFilePath), imports);
    }

    return null;
  }

  /**
   * Parse a specific block config file
   */
  public async parseBlockConfig(configFilePath: string): Promise<PayloadBlock | null> {
    if (!fs.existsSync(configFilePath)) {
      return null;
    }

    const sourceFile = this.createSourceFile(configFilePath);
    
    // Find the block export
    const blockExport = this.findBlockExport(sourceFile);
    if (blockExport) {
      return await this.parseBlockObject(blockExport, path.dirname(configFilePath));
    }

    return null;
  }

  /**
   * Find all config files in a directory tree
   */
  public async findConfigFiles(baseDir: string, pattern: RegExp = /config\.(ts|js)$/): Promise<string[]> {
    const configFiles: string[] = [];
    
    const walkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (item !== 'node_modules' && !item.startsWith('.')) {
            walkDir(fullPath);
          }
        } else if (stat.isFile() && pattern.test(item)) {
          configFiles.push(fullPath);
        }
      }
    };

    walkDir(baseDir);
    return configFiles;
  }

  /**
   * Create TypeScript source file from path
   */
  private createSourceFile(filePath: string): ts.SourceFile {
    const content = fs.readFileSync(filePath, 'utf-8');
    return ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
  }

  /**
   * Find the main config object in payload.config.ts
   */
  private findConfigObject(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | null {
    let configObject: ts.ObjectLiteralExpression | null = null;

    const visit = (node: ts.Node) => {
      // Look for export default or buildConfig() call
      if (ts.isExportAssignment(node) && node.expression) {
        if (ts.isObjectLiteralExpression(node.expression)) {
          configObject = node.expression;
        } else if (ts.isCallExpression(node.expression)) {
          // Handle buildConfig({ ... })
          const args = node.expression.arguments;
          if (args.length > 0 && args[0] && ts.isObjectLiteralExpression(args[0])) {
            configObject = args[0];
          }
        }
      }

      if (!configObject) {
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return configObject;
  }

  /**
   * Find a property in an object literal
   */
  private findProperty(obj: ts.ObjectLiteralExpression, propertyName: string): ts.Expression | null {
    for (const property of obj.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = property.name;
        if (ts.isIdentifier(name) && name.text === propertyName) {
          return property.initializer;
        }
      }
    }
    return null;
  }

  /**
   * Parse collection reference (import or inline)
   */
  private async parseCollectionReference(element: ts.Expression, baseDir: string): Promise<PayloadCollection | null> {
    if (ts.isIdentifier(element)) {
      // This is an import reference, need to resolve it
      const importPath = this.resolveImportPath(element.text, baseDir);
      if (importPath) {
        return await this.parseCollectionConfig(importPath);
      }
    } else if (ts.isObjectLiteralExpression(element)) {
      // Inline collection definition
      return await this.parseCollectionObject(element, baseDir);
    }
    
    return null;
  }

  /**
   * Parse block reference (import or inline)
   */
  private async parseBlockReference(element: ts.Expression, baseDir: string): Promise<PayloadBlock | null> {
    if (ts.isIdentifier(element)) {
      // This is an import reference, need to resolve it
      const importPath = this.resolveImportPath(element.text, baseDir);
      if (importPath) {
        return await this.parseBlockConfig(importPath);
      }
    } else if (ts.isObjectLiteralExpression(element)) {
      // Inline block definition
      return await this.parseBlockObject(element, baseDir);
    }
    
    return null;
  }

  /**
   * Find collection export in a config file
   */
  private findCollectionExport(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | null {
    let collectionObject: ts.ObjectLiteralExpression | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
            if (ts.isObjectLiteralExpression(declaration.initializer)) {
              // Check if this looks like a collection (has slug property)
              const slugProperty = this.findProperty(declaration.initializer, 'slug');
              if (slugProperty) {
                collectionObject = declaration.initializer;
              }
            }
          }
        }
      }

      if (!collectionObject) {
        ts.forEachChild(node, visit);
      }
    };

    visit(sourceFile);
    return collectionObject;
  }

  /**
   * Find block export in a config file
   */
  private findBlockExport(sourceFile: ts.SourceFile): ts.ObjectLiteralExpression | null {
    // Similar to findCollectionExport but for blocks
    return this.findCollectionExport(sourceFile); // They have similar structure
  }

  /**
   * Parse imports from a source file
   */
  private parseImports(sourceFile: ts.SourceFile): Map<string, string> {
    const imports = new Map<string, string>();

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const moduleSpecifier = node.moduleSpecifier.text;

        if (node.importClause) {
          // Handle named imports: import { ButtonBlock } from './path'
          if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
              imports.set(element.name.text, moduleSpecifier);
            }
          }

          // Handle default imports: import ButtonBlock from './path'
          if (node.importClause.name) {
            imports.set(node.importClause.name.text, moduleSpecifier);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  /**
   * Resolve block configuration from identifier
   */
  private async resolveBlockFromIdentifier(
    identifier: string,
    imports: Map<string, string>,
    baseDir: string
  ): Promise<PayloadBlock | null> {
    const moduleSpecifier = imports.get(identifier);
    if (!moduleSpecifier) {
      return null;
    }

    // Resolve the actual file path
    const resolvedPath = this.resolveModulePath(moduleSpecifier, baseDir);
    if (!resolvedPath) {
      return null;
    }

    // Check cache first
    if (this.blockCache.has(resolvedPath)) {
      return this.blockCache.get(resolvedPath)!;
    }

    // Parse the block configuration
    const block = await this.parseBlockConfig(resolvedPath);
    if (block) {
      this.blockCache.set(resolvedPath, block);
    }

    return block;
  }

  /**
   * Parse blocks field with support for identifier references
   */
  private async parseBlocksField(
    arr: ts.ArrayLiteralExpression,
    imports: Map<string, string>,
    baseDir: string
  ): Promise<PayloadBlock[]> {
    const blocks: PayloadBlock[] = [];

    for (const element of arr.elements) {
      let block: PayloadBlock | null = null;

      if (ts.isStringLiteral(element)) {
        // Handle string literal blocks (legacy)
        block = {
          slug: element.text,
          fields: []
        };
      } else if (ts.isIdentifier(element)) {
        // Handle imported block references
        block = await this.resolveBlockFromIdentifier(element.text, imports, baseDir);
      }

      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * Resolve module path to actual file path (enhanced version)
   */
  private resolveModulePath(moduleSpecifier: string, baseDir: string): string | null {
    // Handle relative imports
    if (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../')) {
      const resolved = path.resolve(baseDir, moduleSpecifier);
      const possibleExtensions = ['.ts', '.js'];
      
      for (const ext of possibleExtensions) {
        const withExt = resolved + ext;
        if (fs.existsSync(withExt)) {
          return withExt;
        }
      }
      
      // Try index files
      for (const ext of possibleExtensions) {
        const indexPath = path.join(resolved, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }

    // Handle absolute imports with @ alias
    if (moduleSpecifier.startsWith('@/')) {
      const withoutAlias = moduleSpecifier.replace('@/', '');
      // Find project root from baseDir
      let projectRoot = baseDir;
      // Keep going up until we find the project root (contains src directory)
      while (projectRoot && !fs.existsSync(path.join(projectRoot, 'src'))) {
        const parent = path.dirname(projectRoot);
        if (parent === projectRoot) break; // Reached filesystem root
        projectRoot = parent;
      }
      const srcPath = path.join(projectRoot, 'src', withoutAlias);
      
      const possibleExtensions = ['.ts', '.js'];
      
      for (const ext of possibleExtensions) {
        const withExt = srcPath + ext;
        if (fs.existsSync(withExt)) {
          return withExt;
        }
      }
      
      // Try index files
      for (const ext of possibleExtensions) {
        const indexPath = path.join(srcPath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }

    return null;
  }

  /**
   * Parse collection object literal
   */
  private async parseCollectionObject(
    obj: ts.ObjectLiteralExpression, 
    baseDir: string, 
    imports?: Map<string, string>
  ): Promise<PayloadCollection> {
    const collection: PayloadCollection = {
      slug: '',
      fields: []
    };

    // Extract slug
    const slugProperty = this.findProperty(obj, 'slug');
    if (slugProperty && ts.isStringLiteral(slugProperty)) {
      collection.slug = slugProperty.text;
    }

    // Extract fields
    const fieldsProperty = this.findProperty(obj, 'fields');
    if (fieldsProperty && ts.isArrayLiteralExpression(fieldsProperty)) {
      collection.fields = await this.parseFieldsArray(fieldsProperty, baseDir, imports);
    }

    // Extract labels
    const labelsProperty = this.findProperty(obj, 'labels');
    if (labelsProperty && ts.isObjectLiteralExpression(labelsProperty)) {
      collection.labels = this.parseLabelsObject(labelsProperty);
    }

    return collection;
  }

  /**
   * Parse block object literal
   */
  private async parseBlockObject(obj: ts.ObjectLiteralExpression, baseDir: string): Promise<PayloadBlock> {
    const block: PayloadBlock = {
      slug: '',
      fields: []
    };

    // Extract slug
    const slugProperty = this.findProperty(obj, 'slug');
    if (slugProperty && ts.isStringLiteral(slugProperty)) {
      block.slug = slugProperty.text;
    }

    // Extract fields
    const fieldsProperty = this.findProperty(obj, 'fields');
    if (fieldsProperty && ts.isArrayLiteralExpression(fieldsProperty)) {
      block.fields = await this.parseFieldsArray(fieldsProperty, baseDir);
    }

    // Extract labels
    const labelsProperty = this.findProperty(obj, 'labels');
    if (labelsProperty && ts.isObjectLiteralExpression(labelsProperty)) {
      block.labels = this.parseLabelsObject(labelsProperty);
    }

    return block;
  }

  /**
   * Parse fields array
   */
  private async parseFieldsArray(
    arr: ts.ArrayLiteralExpression, 
    baseDir: string, 
    imports?: Map<string, string>
  ): Promise<PayloadField[]> {
    const fields: PayloadField[] = [];

    for (const element of arr.elements) {
      if (ts.isObjectLiteralExpression(element)) {
        const field = await this.parseFieldObject(element, baseDir, imports);
        if (field) {
          fields.push(field);
        }
      }
    }

    return fields;
  }

  /**
   * Parse field object
   */
  private async parseFieldObject(
    obj: ts.ObjectLiteralExpression, 
    baseDir: string, 
    imports?: Map<string, string>
  ): Promise<PayloadField | null> {
    const field: PayloadField = {
      name: '',
      type: ''
    };

    for (const property of obj.properties) {
      if (ts.isPropertyAssignment(property)) {
        const propertyName = this.getPropertyName(property.name);
        const value = property.initializer;

        switch (propertyName) {
          case 'name':
            if (ts.isStringLiteral(value)) {
              field.name = value.text;
            }
            break;
          case 'type':
            if (ts.isStringLiteral(value)) {
              field.type = value.text;
              // Mark richtext fields with _lexical flag for content transformation
              if (value.text === 'richText') {
                (field as any)._lexical = true;
              }
            }
            break;
          case 'required':
            if (value.kind === ts.SyntaxKind.TrueKeyword) {
              field.required = true;
            } else if (value.kind === ts.SyntaxKind.FalseKeyword) {
              field.required = false;
            }
            break;
          case 'relationTo':
            if (ts.isStringLiteral(value)) {
              field.relationTo = value.text;
            } else if (ts.isArrayLiteralExpression(value)) {
              const relations: string[] = [];
              for (const element of value.elements) {
                if (ts.isStringLiteral(element)) {
                  relations.push(element.text);
                }
              }
              field.relationTo = relations;
            }
            break;
          case 'hasMany':
            if (value.kind === ts.SyntaxKind.TrueKeyword) {
              field.hasMany = true;
            } else if (value.kind === ts.SyntaxKind.FalseKeyword) {
              field.hasMany = false;
            }
            break;
          case 'fields':
            if (ts.isArrayLiteralExpression(value)) {
              field.fields = await this.parseFieldsArray(value, baseDir, imports);
            }
            break;
          case 'blocks':
            if (ts.isArrayLiteralExpression(value) && imports) {
              field.blocks = await this.parseBlocksField(value, imports, baseDir);
            } else if (ts.isArrayLiteralExpression(value)) {
              // Fallback to string parsing if no imports available
              const blocks: string[] = [];
              for (const element of value.elements) {
                if (ts.isStringLiteral(element)) {
                  blocks.push(element.text);
                }
              }
              field.blocks = blocks;
            }
            break;
          case 'tabs':
            if (ts.isArrayLiteralExpression(value)) {
              field.tabs = await this.parseTabsArray(value, baseDir, imports);
            }
            break;
          case 'options':
            if (ts.isArrayLiteralExpression(value)) {
              field.options = this.parseOptionsArray(value);
            }
            break;
          case 'maxRows':
            if (ts.isNumericLiteral(value)) {
              field.maxRows = parseInt(value.text);
            }
            break;
          case 'minRows':
            if (ts.isNumericLiteral(value)) {
              field.minRows = parseInt(value.text);
            }
            break;
          default:
            // Store other properties as-is
            field[propertyName] = this.parseValue(value);
            break;
        }
      }
    }

    return field.type ? field : null;
  }

  /**
   * Parse tabs array
   */
  private async parseTabsArray(
    arr: ts.ArrayLiteralExpression, 
    baseDir: string, 
    imports?: Map<string, string>
  ): Promise<PayloadTab[]> {
    const tabs: PayloadTab[] = [];

    for (const element of arr.elements) {
      if (ts.isObjectLiteralExpression(element)) {
        const tab = await this.parseTabObject(element, baseDir, imports);
        if (tab) {
          tabs.push(tab);
        }
      }
    }

    return tabs;
  }

  /**
   * Parse tab object
   */
  private async parseTabObject(
    obj: ts.ObjectLiteralExpression, 
    baseDir: string, 
    imports?: Map<string, string>
  ): Promise<PayloadTab | null> {
    let label = '';
    let fields: PayloadField[] = [];

    const labelProperty = this.findProperty(obj, 'label');
    if (labelProperty && ts.isStringLiteral(labelProperty)) {
      label = labelProperty.text;
    }

    const fieldsProperty = this.findProperty(obj, 'fields');
    if (fieldsProperty && ts.isArrayLiteralExpression(fieldsProperty)) {
      fields = await this.parseFieldsArray(fieldsProperty, baseDir, imports);
    }

    return label ? { label, fields } : null;
  }

  /**
   * Parse options array for select/radio fields
   */
  private parseOptionsArray(arr: ts.ArrayLiteralExpression): any[] {
    const options: any[] = [];

    for (const element of arr.elements) {
      if (ts.isObjectLiteralExpression(element)) {
        const option: any = {};
        for (const property of element.properties) {
          if (ts.isPropertyAssignment(property)) {
            const propertyName = this.getPropertyName(property.name);
            option[propertyName] = this.parseValue(property.initializer);
          }
        }
        options.push(option);
      } else {
        options.push(this.parseValue(element));
      }
    }

    return options;
  }

  /**
   * Parse labels object
   */
  private parseLabelsObject(obj: ts.ObjectLiteralExpression): any {
    const labels: any = {};

    for (const property of obj.properties) {
      if (ts.isPropertyAssignment(property)) {
        const propertyName = this.getPropertyName(property.name);
        labels[propertyName] = this.parseValue(property.initializer);
      }
    }

    return labels;
  }

  /**
   * Get property name from property name node
   */
  private getPropertyName(name: ts.PropertyName): string {
    if (ts.isIdentifier(name)) {
      return name.text;
    } else if (ts.isStringLiteral(name)) {
      return name.text;
    }
    return '';
  }

  /**
   * Parse generic value from expression
   */
  private parseValue(expr: ts.Expression): any {
    if (ts.isStringLiteral(expr)) {
      return expr.text;
    } else if (ts.isNumericLiteral(expr)) {
      return parseInt(expr.text);
    } else if (expr.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    } else if (expr.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    } else if (ts.isArrayLiteralExpression(expr)) {
      return expr.elements.map(element => this.parseValue(element));
    } else if (ts.isObjectLiteralExpression(expr)) {
      const obj: any = {};
      for (const property of expr.properties) {
        if (ts.isPropertyAssignment(property)) {
          const propertyName = this.getPropertyName(property.name);
          obj[propertyName] = this.parseValue(property.initializer);
        }
      }
      return obj;
    }
    return null;
  }

  /**
   * Resolve import path to actual file path
   */
  private resolveImportPath(importName: string, baseDir: string): string | null {
    // This is a simplified version - in reality, you'd need to trace imports
    // For now, assume standard structure: src/collections/[name]/config.ts or src/blocks/[name]/config.ts
    
    const possiblePaths = [
      path.join(baseDir, 'collections', importName, 'config.ts'),
      path.join(baseDir, 'collections', importName, 'index.ts'),
      path.join(baseDir, 'blocks', importName, 'config.ts'),
      path.join(baseDir, 'blocks', importName, 'index.ts'),
      path.join(baseDir, importName + '.ts'),
      path.join(baseDir, importName, 'config.ts'),
      path.join(baseDir, importName, 'index.ts'),
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return null;
  }
} 