import React from 'react';
import { ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const suggestedPrompts = [
  "Can you explain the Big Bang in a way a 5-year-old would understand?",
  "What are some good gift ideas for a friend's birthday?",
  "Help me come up with catchy titles for an article about ChatGPT use cases"
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onPromptClick }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full px-6 py-12">
      {/* Main Heading */}
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
        How can I assist you today?
      </h2>
      
      {/* Suggested Prompts */}
      <div className="w-full max-w-sm space-y-2">
        {suggestedPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onPromptClick(prompt)}
            className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                {prompt}
              </span>
              <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0 ml-2" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
