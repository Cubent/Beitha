import React from 'react';
import { Message } from '../types';
import { LlmContent } from './LlmContent';
import { ScreenshotMessage } from './ScreenshotMessage';
import { Loader } from '@/components/loader';

interface MessageDisplayProps {
  messages: Message[];
  streamingSegments: Record<number, string>;
  isStreaming: boolean;
  currentPageTitle?: string;
  currentPageUrl?: string;
}

export const MessageDisplay: React.FC<MessageDisplayProps> = ({
  messages,
  streamingSegments,
  isStreaming,
  currentPageTitle,
  currentPageUrl
}) => {
  // Show all messages in the session, but keep track of memory limit for reference
  const MAX_MESSAGES_FOR_MEMORY = 20;
  const filteredMessages = messages;
  const hasMoreMessages = messages.length > MAX_MESSAGES_FOR_MEMORY;

  if (filteredMessages.length === 0 && Object.keys(streamingSegments).length === 0) {
    return <p className="text-gray-500">No output yet</p>;
  }

  return (
    <div className="space-y-2">
      
      {/* Render completed messages in their original order */}
      {filteredMessages.map((msg, index) => (
        <div key={`msg-${index}`} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
          {msg.type === 'system' ? (
            <div className="bg-gray-100 px-3 py-1 rounded text-gray-500 text-sm w-full text-center">
              {msg.content}
            </div>
          ) : msg.type === 'pageContext' ? (
            <div className="text-left text-sm text-gray-600 mb-2">
              <details className="group">
                <summary className="cursor-pointer flex items-center justify-between">
                  <span className="font-medium">Current Page</span>
                  <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-2 text-gray-500">
                  <div className="font-medium text-gray-700">{msg.title}</div>
                  <div className="text-xs break-all">{msg.url}</div>
                </div>
              </details>
            </div>
          ) : msg.type === 'screenshot' && msg.imageData ? (
            <div className="w-full">
              <ScreenshotMessage imageData={msg.imageData} mediaType={msg.mediaType} />
            </div>
          ) : msg.type === 'user' ? (
            <div className="text-black dark:text-white px-4 py-2 rounded-lg max-w-xs break-words overflow-wrap-anywhere hyphens-auto text-sm bg-black/5 dark:bg-white/5">
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {/* Show attached files if any */}
              {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {msg.attachedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-1 bg-black/8 dark:bg-white/8 px-2 py-1 rounded text-xs max-w-24">
                      <div className="w-4 h-4 bg-gray-400 rounded flex items-center justify-center">
                        <span className="text-xs">📄</span>
                      </div>
                      <span className="truncate text-black/70 dark:text-white/70">
                        {file.name.length > 8 ? file.name.substring(0, 8) + '...' : file.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Show image thumbnails if any */}
              {msg.images && msg.images.length > 0 && (
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {msg.images.map((dataURL, index) => (
                    <div key={index} className="flex items-center gap-1 bg-black/8 dark:bg-white/8 px-2 py-1 rounded text-xs max-w-24">
                      <img 
                        src={dataURL} 
                        alt={`Image ${index + 1}`}
                        className="w-4 h-4 object-cover rounded"
                      />
                      <span className="truncate text-black/70 dark:text-white/70">
                        Image {index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-800 px-2 py-0.5 max-w-full break-words text-sm">
              <LlmContent content={msg.content} />
            </div>
          )}
        </div>
      ))}
      
      {/* Render currently streaming segments at the end */}
      {isStreaming && Object.entries(streamingSegments).map(([id, content]) => (
        <div key={`segment-${id}`} className="flex justify-start">
          <div className="text-gray-800 px-2 py-0.5 max-w-full break-words text-sm">
            <LlmContent content={content} />
          </div>
        </div>
      ))}
      
      {/* Show typing loading when streaming but no content yet */}
      {isStreaming && Object.keys(streamingSegments).length === 0 && (
        <div className="flex justify-start">
          <div className="text-gray-800 px-2 py-2 max-w-full">
            <Loader variant="typing" size="sm" />
          </div>
        </div>
      )}
    </div>
  );
};
