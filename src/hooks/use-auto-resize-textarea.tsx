import { useEffect, useRef, useCallback } from "react";

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

export function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        
        // Calculate new height
        const newHeight = Math.max(
            minHeight,
            Math.min(
                textarea.scrollHeight,
                maxHeight ?? Number.POSITIVE_INFINITY
            )
        );

        // Set the new height
        textarea.style.height = `${newHeight}px`;
    }, [minHeight, maxHeight]);

    const resetHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = `${minHeight}px`;
    }, [minHeight]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Set initial height
        textarea.style.height = `${minHeight}px`;

        // Add event listener for input changes
        const handleInput = () => adjustHeight();
        textarea.addEventListener('input', handleInput);

        return () => {
            textarea.removeEventListener('input', handleInput);
        };
    }, [minHeight, adjustHeight]);

    return { textareaRef, adjustHeight, resetHeight };
}
