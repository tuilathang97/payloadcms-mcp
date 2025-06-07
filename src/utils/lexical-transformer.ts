/**
 * Lexical Transformer Utility
 * 
 * Converts plain text strings to Lexical Editor JSON format
 * for PayloadCMS richtext fields
 */

export interface LexicalTextNode {
  type: 'text';
  text: string;
  format?: number;
}

export interface LexicalParagraphNode {
  type: 'paragraph';
  children: LexicalTextNode[];
}

export interface LexicalHeadingNode {
  type: 'heading';
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  children: LexicalTextNode[];
}

export interface LexicalRoot {
  type: 'root';
  children: (LexicalParagraphNode | LexicalHeadingNode)[];
}

export interface LexicalEditorState {
  root: LexicalRoot;
}

/**
 * Convert plain text string to Lexical JSON format
 */
export function stringToLexical(text: string): LexicalEditorState {
  if (!text || typeof text !== 'string') {
    return createEmptyLexical();
  }

  // Split text into paragraphs (by double newlines or single newlines)
  const paragraphs = text.split('\n').filter(p => p.trim().length > 0);
  
  if (paragraphs.length === 0) {
    return createEmptyLexical();
  }

  const children: (LexicalParagraphNode | LexicalHeadingNode)[] = paragraphs.map(paragraph => {
    const trimmed = paragraph.trim();
    
    // Check if it looks like a heading (starts with # or is short and title-case)
    if (trimmed.startsWith('#')) {
      const level = (trimmed.match(/^#+/) || [''])[0].length;
      const headingText = trimmed.replace(/^#+\s*/, '');
      const tag = `h${Math.min(level, 6)}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      
      return {
        type: 'heading',
        tag,
        children: [{
          type: 'text',
          text: headingText
        }]
      } as LexicalHeadingNode;
    }
    
    // Regular paragraph
    return {
      type: 'paragraph',
      children: [{
        type: 'text',
        text: trimmed
      }]
    } as LexicalParagraphNode;
  });

  return {
    root: {
      type: 'root',
      children
    }
  };
}

/**
 * Create empty Lexical structure with single empty paragraph
 */
export function createEmptyLexical(): LexicalEditorState {
  return {
    root: {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'text',
          text: ''
        }]
      }]
    }
  };
}

/**
 * Create Lexical structure with simple paragraph content
 */
export function createSimpleLexical(text: string): LexicalEditorState {
  return {
    root: {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'text',
          text: text || ''
        }]
      }]
    }
  };
}

/**
 * Validate if an object is a valid Lexical structure
 */
export function isValidLexical(obj: any): obj is LexicalEditorState {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.root &&
    obj.root.type === 'root' &&
    Array.isArray(obj.root.children)
  );
}

/**
 * Convert markdown-style text to Lexical format
 * Supports basic markdown: headers, paragraphs
 */
export function markdownToLexical(markdown: string): LexicalEditorState {
  if (!markdown || typeof markdown !== 'string') {
    return createEmptyLexical();
  }

  const lines = markdown.split('\n');
  const children: (LexicalParagraphNode | LexicalHeadingNode)[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.length === 0) {
      continue; // Skip empty lines
    }
    
    // Handle headers (# ## ### etc.)
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch && headerMatch[1] && headerMatch[2]) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      
      children.push({
        type: 'heading',
        tag,
        children: [{
          type: 'text',
          text
        }]
      });
      continue;
    }
    
    // Regular paragraph
    children.push({
      type: 'paragraph',
      children: [{
        type: 'text',
        text: trimmed
      }]
    });
  }
  
  // Ensure we have at least one child
  if (children.length === 0) {
    return createEmptyLexical();
  }

  return {
    root: {
      type: 'root',
      children
    }
  };
}