import React from 'react';
import { ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const suggestedPrompts = [
  "Tell me something about the Big Bang so that I can explain it to my 5-year-old child",
  "Please provide me with 10 gift ideas for my friend's birthday",
  "Generate five catchy titles for my writing about the use case of ChatGPT"
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onPromptClick }) => {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
      {/* Main Heading */}
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
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
              <span className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed">
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
