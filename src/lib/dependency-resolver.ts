/**
 * Dependency Resolver for Bootstrap Operations
 * 
 * Analyzes user content and PayloadCMS schema to identify missing relationships
 * and automatically resolve dependencies during content creation.
 */

import { logger } from '../utils/logger.js';
import { PayloadCMSClient } from './payload-client.js';
import { FieldStructure } from '../tools/prepare-tools.js';
import { DependencyRequest } from './context-manager.js';

export interface DependencyAnalysis {
  requiredDependencies: {
    [collection: string]: DependencyRequest[];
  };
  creationOrder: string[];
  circularDependencies: string[];
}

export interface ContentDependency {
  collection: string;
  field: string;
  relationTo: string;
  required: boolean;
  hasMany: boolean;
  missingReferences: string[];
}

export class DependencyResolver {
  constructor(
    private payloadClient: PayloadCMSClient
  ) {}

  /**
   * Analyze user content for missing dependencies
   */
  async analyzeDependencies(
    userContent: any,
    parsedStructure: any
  ): Promise<DependencyAnalysis> {
    logger.info('DependencyResolver', 'Starting dependency analysis');

    const requiredDependencies: { [collection: string]: DependencyRequest[] } = {};
    const dependencies: ContentDependency[] = [];

    // Analyze each collection in user content
    for (const [collectionSlug, collectionContent] of Object.entries(userContent.collections || {})) {
      if (!collectionContent || !Array.isArray(collectionContent)) continue;

      const collectionStructure = parsedStructure.collections?.[collectionSlug];
      if (!collectionStructure) continue;

      logger.debug('DependencyResolver', 'Analyzing collection', { collectionSlug });

      // Analyze each document in the collection
      for (const document of collectionContent) {
        const collectionDeps = await this.analyzeDocumentDependencies(
          document,
          collectionStructure,
          collectionSlug
        );
        dependencies.push(...collectionDeps);
      }
    }

    // Group dependencies by collection
    for (const dep of dependencies) {
      if (!dep.relationTo) continue; // Skip dependencies without relationTo
      
      if (!requiredDependencies[dep.collection]) {
        requiredDependencies[dep.collection] = [];
      }

      const collectionDeps = requiredDependencies[dep.collection];
      if (!collectionDeps) continue; // Should never happen but satisfies TypeScript

      // Check if this dependency request already exists
      const exists = collectionDeps.some(
        existing => existing.field === dep.field && existing.relationTo === dep.relationTo
      );

      if (!exists) {
        collectionDeps.push({
          field: dep.field,
          relationTo: dep.relationTo,
          required: dep.required,
          hasMany: dep.hasMany,
          description: `Required ${dep.hasMany ? 'multiple' : 'single'} reference(s) to ${dep.relationTo} collection for ${dep.field} field`,
          suggestedContent: await this.generateSuggestedContent(dep)
        });
      }
    }

    // Calculate creation order
    const creationOrder = this.calculateCreationOrder(Object.keys(requiredDependencies), dependencies);
    
    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(dependencies);

    logger.info('DependencyResolver', 'Dependency analysis complete', {
      totalDependencies: dependencies.length,
      uniqueCollections: Object.keys(requiredDependencies).length,
      creationOrder,
      circularDependencies
    });

    return {
      requiredDependencies,
      creationOrder,
      circularDependencies
    };
  }

  /**
   * Analyze a single document for relationship dependencies
   */
  private async analyzeDocumentDependencies(
    document: any,
    collectionStructure: any,
    collectionSlug: string
  ): Promise<ContentDependency[]> {
    const dependencies: ContentDependency[] = [];

    if (collectionStructure?.fields) {
      await this.analyzeFields(document, collectionStructure.fields, collectionSlug, dependencies);
    }

    return dependencies;
  }

  /**
   * Recursively analyze fields for relationship dependencies
   */
  private async analyzeFields(
    data: any,
    fields: FieldStructure[],
    collectionSlug: string,
    dependencies: ContentDependency[],
    fieldPath: string = ''
  ): Promise<void> {
    for (const field of fields) {
      const fullFieldPath = fieldPath ? `${fieldPath}.${field.name}` : field.name;
      const fieldValue = data[field.name];

      if (field.type === 'relationship' && field.relationTo) {
        await this.analyzeRelationshipField(
          fieldValue,
          field,
          collectionSlug,
          fullFieldPath,
          dependencies
        );
      } else if (field.type === 'upload' && field.relationTo) {
        await this.analyzeUploadField(
          fieldValue,
          field,
          collectionSlug,
          fullFieldPath,
          dependencies
        );
      } else if (field.type === 'blocks' && field.blocks && fieldValue) {
        // Analyze block content recursively
        if (Array.isArray(fieldValue)) {
          for (const block of fieldValue) {
            if (block.blockType && block.fields) {
              // Would need block structure here - simplified for now
              logger.debug('DependencyResolver', 'Skipping block field analysis', { 
                blockType: block.blockType 
              });
            }
          }
        }
      } else if (field.type === 'array' && field.fields && Array.isArray(fieldValue)) {
        // Analyze array items
        for (const item of fieldValue) {
          await this.analyzeFields(item, field.fields, collectionSlug, dependencies, fullFieldPath);
        }
      } else if (field.type === 'group' && field.fields && fieldValue) {
        // Analyze group fields
        await this.analyzeFields(fieldValue, field.fields, collectionSlug, dependencies, fullFieldPath);
      }
    }
  }

  /**
   * Analyze relationship field for missing references
   */
  private async analyzeRelationshipField(
    fieldValue: any,
    field: FieldStructure,
    collectionSlug: string,
    fieldPath: string,
    dependencies: ContentDependency[]
  ): Promise<void> {
    if (!field.relationTo || !fieldValue) return;

    const relationToRaw = Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo;
    if (!relationToRaw) return;
    
    const relationTo: string = relationToRaw; // Type assertion since we checked it's not undefined
    const hasMany = field.hasMany || false;
    const required = field.required || false;

    let missingReferences: string[] = [];

    if (hasMany && Array.isArray(fieldValue)) {
      // Multiple relationships
      for (const value of fieldValue) {
        if (typeof value === 'string') {
          // Reference by ID - check if exists
          const exists = await this.checkReferenceExists(relationTo, value);
          if (!exists) {
            missingReferences.push(value);
          }
        } else if (typeof value === 'object' && value?.title) {
          // Reference by title/name - need to create
          missingReferences.push(value.title);
        }
      }
    } else if (fieldValue) {
      // Single relationship
      if (typeof fieldValue === 'string') {
        // Reference by ID
        const exists = await this.checkReferenceExists(relationTo, fieldValue);
        if (!exists) {
          missingReferences.push(fieldValue);
        }
      } else if (typeof fieldValue === 'object' && (fieldValue?.title || fieldValue?.name)) {
        // Reference by title/name
        missingReferences.push(fieldValue.title || fieldValue.name);
      }
    }

    if (missingReferences.length > 0 || required) {
      dependencies.push({
        collection: collectionSlug,
        field: fieldPath,
        relationTo,
        required,
        hasMany,
        missingReferences
      });
    }
  }

  /**
   * Analyze upload field for missing media references
   */
  private async analyzeUploadField(
    fieldValue: any,
    field: FieldStructure,
    collectionSlug: string,
    fieldPath: string,
    dependencies: ContentDependency[]
  ): Promise<void> {
    const relationToRaw = Array.isArray(field.relationTo) ? field.relationTo[0] : (field.relationTo || 'media');
    const relationTo: string = relationToRaw || 'media'; // Default to 'media' if undefined
    const hasMany = field.hasMany || false;
    const required = field.required || false;

    let missingReferences: string[] = [];

    if (hasMany && Array.isArray(fieldValue)) {
      for (const value of fieldValue) {
        if (typeof value === 'string') {
          const exists = await this.checkReferenceExists(relationTo, value);
          if (!exists) {
            missingReferences.push(value);
          }
        } else if (typeof value === 'object' && value && value.filename) {
          missingReferences.push(value.filename);
        }
      }
    } else if (fieldValue) {
      if (typeof fieldValue === 'string') {
        const exists = await this.checkReferenceExists(relationTo, fieldValue);
        if (!exists) {
          missingReferences.push(fieldValue);
        }
      } else if (typeof fieldValue === 'object' && fieldValue && fieldValue.filename) {
        missingReferences.push(fieldValue.filename);
      }
    }

    if (missingReferences.length > 0 || required) {
      dependencies.push({
        collection: collectionSlug,
        field: fieldPath,
        relationTo,
        required,
        hasMany,
        missingReferences
      });
    }
  }

  /**
   * Check if a reference exists in the target collection
   */
  private async checkReferenceExists(collection: string, id: string): Promise<boolean> {
    try {
      await this.payloadClient.findById(collection, id);
      return true;
    } catch (error) {
      logger.debug('DependencyResolver', 'Reference not found', { collection, id });
      return false;
    }
  }

  /**
   * Calculate optimal creation order based on dependencies
   */
  private calculateCreationOrder(collections: string[], dependencies: ContentDependency[]): string[] {
    const dependencyGraph: { [collection: string]: Set<string> } = {};
    const inDegree: { [collection: string]: number } = {};

    // Initialize graph
    for (const collection of collections) {
      dependencyGraph[collection] = new Set();
      inDegree[collection] = 0;
    }

    // Build dependency graph
    for (const dep of dependencies) {
      if (dep.relationTo && collections.includes(dep.relationTo) && !dependencyGraph[dep.collection]?.has(dep.relationTo)) {
        dependencyGraph[dep.collection]?.add(dep.relationTo);
        inDegree[dep.relationTo] = (inDegree[dep.relationTo] || 0) + 1;
      }
    }

    // Topological sort
    const result: string[] = [];
    const queue: string[] = [];

    // Find collections with no dependencies
    for (const collection of collections) {
      if (inDegree[collection] === 0) {
        queue.push(collection);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // Update dependencies
      for (const collection of collections) {
        if (dependencyGraph[collection]?.has(current)) {
          dependencyGraph[collection]?.delete(current);
          inDegree[collection] = (inDegree[collection] || 1) - 1;
          
          if (inDegree[collection] === 0) {
            queue.push(collection);
          }
        }
      }
    }

    // Add remaining collections (those in cycles)
    for (const collection of collections) {
      if (!result.includes(collection)) {
        result.push(collection);
      }
    }

    return result;
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(dependencies: ContentDependency[]): string[] {
    const visited: Set<string> = new Set();
    const recursionStack: Set<string> = new Set();
    const cycles: string[] = [];

    const dependencyMap: { [collection: string]: string[] } = {};
    
    // Build dependency map
    for (const dep of dependencies) {
      if (!dependencyMap[dep.collection]) {
        dependencyMap[dep.collection] = [];
      }
      if (dep.relationTo) {
        dependencyMap[dep.collection]?.push(dep.relationTo);
      }
    }

    const dfs = (collection: string, path: string[]): boolean => {
      if (recursionStack.has(collection)) {
        cycles.push(path.join(' -> ') + ' -> ' + collection);
        return true;
      }

      if (visited.has(collection)) {
        return false;
      }

      visited.add(collection);
      recursionStack.add(collection);

      const dependencies = dependencyMap[collection] || [];
      for (const dep of dependencies) {
        if (dfs(dep, [...path, collection])) {
          return true;
        }
      }

      recursionStack.delete(collection);
      return false;
    };

    // Check all collections for cycles
    for (const collection of Object.keys(dependencyMap)) {
      if (!visited.has(collection)) {
        dfs(collection, []);
      }
    }

    return cycles;
  }

  /**
   * Generate suggested content for missing dependencies
   */
  private async generateSuggestedContent(dependency: ContentDependency): Promise<any> {
    const { relationTo, hasMany, missingReferences } = dependency;

    if (relationTo === 'media') {
      return hasMany 
        ? missingReferences.map(ref => ({ filename: ref, description: 'Placeholder image' }))
        : { filename: missingReferences[0] || 'placeholder.png', description: 'Placeholder image' };
    }

    if (relationTo === 'categories') {
      return hasMany
        ? missingReferences.map(ref => ({ title: ref, slug: ref.toLowerCase().replace(/\s+/g, '-') }))
        : { title: missingReferences[0] || 'General', slug: 'general' };
    }

    if (relationTo === 'testimonials') {
      return hasMany
        ? missingReferences.map((ref, index) => ({
            name: `Customer ${index + 1}`,
            title: 'Happy Customer',
            content: `Great service and products!`,
            rating: 5
          }))
        : {
            name: 'Happy Customer',
            title: 'Verified Buyer',
            content: 'Excellent experience with this company.',
            rating: 5
          };
    }

    // Generic suggestions
    return hasMany
      ? missingReferences.map(ref => ({ title: ref, name: ref }))
      : { title: missingReferences[0] || 'Sample Content', name: missingReferences[0] || 'Sample Content' };
  }
}