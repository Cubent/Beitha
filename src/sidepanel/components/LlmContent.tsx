import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface LlmContentProps {
  content: string;
}

export const LlmContent: React.FC<LlmContentProps> = ({ content }) => {
  // Split content into regular text and tool calls
  const parts: Array<{ type: 'text' | 'tool', content: string, toolName?: string, toolArgs?: string }> = [];
  
  // Process the content to identify tool calls
  // Create a combined regex that handles both direct tool calls and those wrapped in code blocks (xml or bash)
  const combinedToolCallRegex = /(```(?:xml|bash)\s*)?<tool>(.*?)<\/tool>\s*<input>([\s\S]*?)<\/input>(?:\s*<requires_approval>(.*?)<\/requires_approval>)?(\s*```)?/g;
  
  // Handle all emoji tool formats: 🕹️ tool: toolName | args: toolArgs OR 🕹️ toolName
  const emojiToolCallRegex = /🕹️ (?:tool: )?([^|\s]+)(?:\s*\|\s*args:\s*(.+))?/g;
  
  let lastIndex = 0;
  
  // Create a copy of the content to work with
  const contentCopy = content.toString();
  
  // Reset regex lastIndex
  combinedToolCallRegex.lastIndex = 0;
  emojiToolCallRegex.lastIndex = 0;
  
  // Process all tool calls (both direct and code block) in a single pass
  let match;
  while ((match = combinedToolCallRegex.exec(contentCopy)) !== null) {
    // Add text before the tool call
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: contentCopy.substring(lastIndex, match.index)
      });
    }
    
    // Add the tool call
    parts.push({
      type: 'tool',
      content: match[0]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Process emoji tool calls (both with and without args)
  emojiToolCallRegex.lastIndex = 0;
  while ((match = emojiToolCallRegex.exec(contentCopy)) !== null) {
    // Add text before the tool call
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: contentCopy.substring(lastIndex, match.index)
      });
    }
    
    // Add the emoji tool call with parsed tool name and args (args might be undefined)
    parts.push({
      type: 'tool',
      content: match[0],
      toolName: match[1].trim(),
      toolArgs: match[2] ? match[2].trim() : ''
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining text after the last tool call
  if (lastIndex < contentCopy.length) {
    parts.push({
      type: 'text',
      content: contentCopy.substring(lastIndex)
    });
  }

  // If no tool calls were found, just return the whole content
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: content
    });
  }
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          // Filter out unwanted tab information
          const filteredContent = part.content
            .replace(/Tab \d+/g, '')
            .replace(/URL\s*$/gm, '')
            .replace(/\n\s*\n/g, '\n')
            .trim();
          
          if (!filteredContent) {
            return null;
          }
          
          // Render regular text with markdown
          return (
            <ReactMarkdown 
              key={index}
              remarkPlugins={[remarkGfm]}
              components={{
                // Apply Tailwind classes to markdown elements
                p: ({node, ...props}) => <p className="mb-2" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-md font-bold mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                li: ({node, ...props}) => <li className="mb-1" {...props} />,
                a: ({node, ...props}) => <a className="text-primary underline" {...props} />,
                code: ({node, className, children, ...props}) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match && !className;
                  return isInline 
                    ? <code className="bg-base-300 px-1 rounded text-sm" {...props}>{children}</code>
                    : <pre className="bg-base-300 p-2 rounded text-sm overflow-auto my-2"><code {...props}>{children}</code></pre>;
                },
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-base-300 pl-4 italic my-2" {...props} />,
                table: ({node, ...props}) => <table className="border-collapse table-auto w-full my-2" {...props} />,
                th: ({node, ...props}) => <th className="border border-base-300 px-4 py-2 text-left" {...props} />,
                td: ({node, ...props}) => <td className="border border-base-300 px-4 py-2" {...props} />,
              }}
            >
              {filteredContent}
            </ReactMarkdown>
          );
        } else {
          // Render tool calls with special styling
          if (part.toolName) {
            // Render emoji tool calls with clean design
            const getToolDisplayName = (toolName: string) => {
              switch (toolName) {
                case 'lookup_memories':
                  return 'Looking Memories';
                case 'browser_read_text':
                  return 'Reading Text';
                case 'browser_click':
                  return 'Clicking';
                case 'browser_type':
                  return 'Typing';
                case 'browser_navigate':
                  return 'Navigating';
                case 'browser_screenshot':
                  return 'Taking Screenshot';
                case 'browser_press_key':
                  return 'Pressing Key';
                case 'browser_scroll':
                  return 'Scrolling';
                case 'browser_wait':
                  return 'Waiting';
                case 'browser_hover':
                  return 'Hovering';
                case 'browser_snapshot_dom':
                  return 'Taking DOM Snapshot';
                case 'browser_query':
                  return 'Querying Elements';
                case 'browser_wait_for':
                  return 'Waiting For Element';
                case 'browser_get_attribute':
                  return 'Getting Attribute';
                case 'browser_scroll_to':
                  return 'Scrolling To Element';
                default:
                  return toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              }
            };

            return (
              <div key={index} className="text-left text-sm text-gray-600 mb-0.5 py-0.5">
                <span className="font-medium">{getToolDisplayName(part.toolName)}</span>
                {part.toolArgs && part.toolArgs.trim() && (
                  <span className="text-gray-500 ml-2">{part.toolArgs}</span>
                )}
              </div>
            );
          } else {
            // For other tool call formats, return null to prevent empty bubbles
            return null;
          }
        }
      })}
    </>
  );
};
