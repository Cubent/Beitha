import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import { AIInput } from '@/components/ui/ai-input';

interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  tabStatus: 'attached' | 'detached' | 'unknown' | 'running' | 'idle' | 'error';
  mode?: 'ask' | 'do';
  onGlobeClick?: () => void;
  isGlobeActive?: boolean;
  currentTabTitle?: string;
  currentTabFavicon?: string;
  onAttachClick?: () => void;
  inputValue?: string;
  onInputValueChange?: (value: string) => void;
}

export const PromptForm: React.FC<PromptFormProps> = ({
  onSubmit,
  onCancel,
  isProcessing,
  tabStatus,
  mode = 'do',
  onGlobeClick,
  isGlobeActive = false,
  currentTabTitle,
  currentTabFavicon,
  onAttachClick,
  inputValue,
  onInputValueChange
}) => {
  const isDisabled = isProcessing || tabStatus === 'detached';
  
  const placeholder = tabStatus === 'detached' 
    ? "Tab connection lost. Please refresh the tab to continue." 
    : mode === 'ask' 
      ? "Ask me anything..." 
      : "Tell me what to do...";

  return (
    <div className="mt-4 relative">
      <AIInput
        placeholder={placeholder}
        onSubmit={onSubmit}
        className="w-full"
        onGlobeClick={onGlobeClick}
        isGlobeActive={isGlobeActive}
        currentTabTitle={currentTabTitle}
        currentTabFavicon={currentTabFavicon}
        currentTabStatus={tabStatus}
        onCancel={onCancel}
        showCancel={isProcessing}
        onAttachClick={onAttachClick}
        inputValue={inputValue}
        onInputValueChange={onInputValueChange}
      />
    </div>
  );
};
