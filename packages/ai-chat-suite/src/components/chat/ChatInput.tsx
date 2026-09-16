import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Plus,
} from 'lucide-react';
import { SkillSummary } from '../../types/skills';
import { ModelOption } from '../../types/chat';
import { ModelSelector } from './ModelSelector';

export interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStopStreaming?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  skills?: SkillSummary[];
  models?: ModelOption[];
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  selectedEffortId?: string;
  onSelectEffort?: (effortId: string) => void;
  onAddAttachment?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  disabled = false,
  placeholder = 'Message the AI...',
  skills = [],
  models = [],
  selectedModelId,
  onSelectModel,
  selectedEffortId,
  onSelectEffort,
  onAddAttachment,
}) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!input.trim() || disabled || isStreaming) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto w-full px-4 pb-4 select-none">
      {/* Main Claude-style Input Box */}
      <div className="relative rounded-2xl border border-slate-300/80 dark:border-white/10 bg-white dark:bg-[#1e1e20] shadow-md focus-within:border-slate-400 dark:focus-within:border-white/20 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent rounded-2xl px-4 pt-3.5 pb-12 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none max-h-48 leading-relaxed"
        />

        {/* Bottom Toolbar inside Input Box */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
          {/* Left tools: Claude + Button */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onAddAttachment}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              title="Add attachment or action"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Right tools: Model & Effort Pill + Terracotta Send Button */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {models.length > 0 && (
              <ModelSelector
                models={models}
                selectedModelId={selectedModelId}
                onSelectModel={onSelectModel}
                selectedEffortId={selectedEffortId}
                onSelectEffort={onSelectEffort}
              />
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                className="w-8 h-8 rounded-xl bg-[#d97757] hover:bg-[#c86646] text-white flex items-center justify-center transition-colors shadow-sm"
                title="Stop generation"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || disabled}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  input.trim() && !disabled
                    ? 'bg-[#d97757] hover:bg-[#c86646] text-white shadow-sm'
                    : 'bg-slate-200 dark:bg-[#2c2c30] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 text-center text-[11px] text-slate-400">
        AI responses can contain errors. Verify critical information.
      </div>
    </div>
  );
};
