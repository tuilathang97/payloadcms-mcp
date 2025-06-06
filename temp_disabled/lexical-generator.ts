/**
 * Lexical Content Generator
 * 
 * This class handles conversion of text to Lexical rich text format
 * used by PayloadCMS. It creates proper Lexical node structures
 * for various rich text content.
 */

import type { SerializedEditorState } from 'lexical';

export interface LexicalConfig {
  features?: string[];
  allowedElements?: string[];
}

export interface LexicalNode {
  children?: LexicalNode[];
  direction?: 'ltr' | 'rtl';
  format?: number;
  indent?: number;
  type: string;
  version: number;
  tag?: string;
  text?: string;
  mode?: string;
  style?: string;
  rel?: string;
  target?: string;
  title?: string;
  url?: string;
  listType?: 'bullet' | 'number';
  start?: number;
  value?: number;
}

export class LexicalGenerator {
  // private config: LexicalConfig;

  constructor(config: LexicalConfig = {}) {
    // Store config if needed in the future
    config = {
      features: ['headings', 'lists', 'links', 'bold', 'italic'],
      allowedElements: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'strong', 'em'],
      ...config,
    };
  }

  convertToLexical(text: string, format: 'plaintext' | 'html' | 'markdown' = 'plaintext'): SerializedEditorState {
    try {
      switch (format) {
        case 'html':
          return this.convertHtmlToLexical(text);
        case 'markdown':
          return this.convertMarkdownToLexical(text);
        case 'plaintext':
        default:
          return this.convertPlaintextToLexical(text);
      }
    } catch (error) {
      console.error('Failed to convert content to Lexical format:', error);
      // Fallback to simple paragraph
      return this.createSimpleParagraph(text);
    }
  }

  private convertPlaintextToLexical(text: string): SerializedEditorState {
    const paragraphs = text.split('\n\n').filter(p => p.trim());
    const children: LexicalNode[] = [];

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // Check if it looks like a heading (starts with #, or is short and doesn't end with punctuation)
      if (this.isHeading(trimmedParagraph)) {
        children.push(this.createHeadingNode(trimmedParagraph));
      } else if (this.isList(trimmedParagraph)) {
        const listItems = this.parseListItems(trimmedParagraph);
        children.push(this.createListNode(listItems, 'bullet'));
      } else {
        children.push(this.createParagraphNode(trimmedParagraph));
      }
    }

    return {
      root: {
        children,
        direction: 'ltr',
        format: 0,
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  private convertHtmlToLexical(html: string): SerializedEditorState {
    // Simple HTML parsing - in production, you might want to use a proper HTML parser
    const children: LexicalNode[] = [];
    
    // Remove HTML tags for simple conversion
    const withoutTags = html
      .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_, level, content) => {
        children.push(this.createHeadingNode(content.trim(), parseInt(level)));
        return '';
      })
      .replace(/<p[^>]*>(.*?)<\/p>/gi, (_, content) => {
        children.push(this.createParagraphNode(content.trim()));
        return '';
      })
      .replace(/<ul[^>]*>(.*?)<\/ul>/gi, (_, content) => {
        const items = content.match(/<li[^>]*>(.*?)<\/li>/gi)?.map((li: string) => 
          li.replace(/<li[^>]*>(.*?)<\/li>/gi, '$1').trim()
        ) || [];
        children.push(this.createListNode(items, 'bullet'));
        return '';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gi, (_, content) => {
        const items = content.match(/<li[^>]*>(.*?)<\/li>/gi)?.map((li: string) => 
          li.replace(/<li[^>]*>(.*?)<\/li>/gi, '$1').trim()
        ) || [];
        children.push(this.createListNode(items, 'number'));
        return '';
      });

    // Handle any remaining text as paragraphs
    const remainingText = withoutTags.replace(/<[^>]*>/g, '').trim();
    if (remainingText) {
      children.push(this.createParagraphNode(remainingText));
    }

    return {
      root: {
        children,
        direction: 'ltr',
        format: 0,
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  private convertMarkdownToLexical(markdown: string): SerializedEditorState {
    const lines = markdown.split('\n');
    const children: LexicalNode[] = [];
    let currentList: string[] = [];
    let listType: 'bullet' | 'number' | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Flush current list if we hit an empty line
        if (currentList.length > 0) {
          children.push(this.createListNode(currentList, listType || 'bullet'));
          currentList = [];
          listType = null;
        }
        continue;
      }

      // Headings
      const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1]!.length;
        const text = headingMatch[2]!;
        children.push(this.createHeadingNode(text, level));
        continue;
      }

      // Lists
      const bulletMatch = trimmedLine.match(/^[\*\-\+]\s+(.+)$/);
      const numberMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);

      if (bulletMatch) {
        if (listType !== 'bullet') {
          // Flush previous list if type changed
          if (currentList.length > 0) {
            children.push(this.createListNode(currentList, listType || 'bullet'));
            currentList = [];
          }
          listType = 'bullet';
        }
        currentList.push(bulletMatch[1]!);
        continue;
      }

      if (numberMatch) {
        if (listType !== 'number') {
          // Flush previous list if type changed
          if (currentList.length > 0) {
            children.push(this.createListNode(currentList, listType || 'bullet'));
            currentList = [];
          }
          listType = 'number';
        }
        currentList.push(numberMatch[1]!);
        continue;
      }

      // Regular paragraph
      if (currentList.length > 0) {
        children.push(this.createListNode(currentList, listType || 'bullet'));
        currentList = [];
        listType = null;
      }
      children.push(this.createParagraphNode(trimmedLine));
    }

    // Flush any remaining list
    if (currentList.length > 0) {
      children.push(this.createListNode(currentList, listType || 'bullet'));
    }

    return {
      root: {
        children,
        direction: 'ltr',
        format: 0,
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  private createParagraphNode(text: string): LexicalNode {
    return {
      children: this.createTextNodes(text),
      direction: 'ltr',
      format: 0,
      indent: 0,
      type: 'paragraph',
      version: 1,
    };
  }

  private createHeadingNode(text: string, level: number = 2): LexicalNode {
    return {
      children: this.createTextNodes(text),
      direction: 'ltr',
      format: 0,
      indent: 0,
      type: 'heading',
      version: 1,
      tag: `h${Math.min(Math.max(level, 1), 6)}`,
    };
  }

  private createListNode(items: string[], listType: 'bullet' | 'number'): LexicalNode {
    const listItems: LexicalNode[] = items.map((item, index) => ({
      children: this.createTextNodes(item),
      direction: 'ltr',
      format: 0,
      indent: 0,
      type: 'listitem',
      version: 1,
      value: listType === 'number' ? index + 1 : undefined,
    }));

    return {
      children: listItems,
      direction: 'ltr',
      format: 0,
      indent: 0,
      type: 'list',
      version: 1,
      listType,
      start: listType === 'number' ? 1 : undefined,
    };
  }

  private createTextNodes(text: string): LexicalNode[] {
    const parts = this.parseInlineFormatting(text);
    return parts.map(part => {
      if (part.type === 'link') {
        return {
          children: [
            {
              text: part.text,
              type: 'text',
              version: 1,
              format: 0,
              mode: 'normal',
              style: '',
            },
          ],
          direction: 'ltr',
          format: 0,
          indent: 0,
          type: 'link',
          version: 1,
          url: part.url || '',
          rel: '',
          target: '',
          title: '',
        };
      } else {
        return {
          text: part.text,
          type: 'text',
          version: 1,
          format: part.format || 0,
          mode: 'normal',
          style: '',
        };
      }
    });
  }

  private parseInlineFormatting(text: string): Array<{ type: 'text' | 'link'; text: string; format?: number; url?: string }> {
    const parts: Array<{ type: 'text' | 'link'; text: string; format?: number; url?: string }> = [];
    
    // Simple markdown link parsing: [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        parts.push(...this.parseTextFormatting(beforeText));
      }

      // Add the link
      parts.push({
        type: 'link',
        text: match[1]!,
        url: match[2],
      });

      lastIndex = linkRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      parts.push(...this.parseTextFormatting(remainingText));
    }

    return parts;
  }

  private parseTextFormatting(text: string): Array<{ type: 'text'; text: string; format?: number }> {
    // Simple bold (**text**) and italic (*text*) parsing
    const parts: Array<{ type: 'text'; text: string; format?: number }> = [];
    
    // For now, just return plain text
    // In a full implementation, you'd parse **bold** and *italic* markdown
    if (text.trim()) {
      parts.push({
        type: 'text',
        text: text,
        format: 0, // 0 = normal, 1 = bold, 2 = italic, 3 = bold+italic
      });
    }

    return parts;
  }

  private createSimpleParagraph(text: string): SerializedEditorState {
    return {
      root: {
        children: [
          {
            children: [
              {
                text: text,
                type: 'text',
                version: 1,
                format: 0,
                mode: 'normal',
                style: '',
              },
            ],
            direction: 'ltr',
            format: 0,
            indent: 0,
            type: 'paragraph',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: 0,
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }

  private isHeading(text: string): boolean {
    // Simple heuristic: short text (< 100 chars) that doesn't end with punctuation
    return text.length < 100 && 
           !text.match(/[.!?;,]$/) && 
           !text.includes('\n') &&
           text.length > 5;
  }

  private isList(text: string): boolean {
    // Check if text contains list-like patterns
    return /^[\*\-\+•]\s+/m.test(text) || /^\d+\.\s+/m.test(text);
  }

  private parseListItems(text: string): string[] {
    const lines = text.split('\n');
    const items: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[\*\-\+•]\s+(.+)$/);
      const numberMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      
      if (bulletMatch) {
        items.push(bulletMatch[1]!);
      } else if (numberMatch) {
        items.push(numberMatch[1]!);
      }
    }

    return items;
  }
} 