import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown, Sparkles, Terminal, FileText, Compass, ShieldAlert } from 'lucide-react';
import { ChatMessage, getMessageSiblings } from '../../types/chat';
import { SkillSummary } from '../../types/skills';
import { MessageBubble } from './MessageBubble';

export interface MessageListProps {
  messages: ChatMessage[];
  allMessages?: ChatMessage[];
  userDisplayName?: string;
  userAvatarUrl?: string;
  onOpenArtifact?: (artifactId: string) => void;
  onQuickPrompt?: (prompt: string) => void;
  isEphemeral?: boolean;
  skills?: SkillSummary[];
  allowRegeneration?: boolean;
  allowEditingUserMessages?: boolean;
  onSwitchSibling?: (siblingId: string) => void;
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  onRegenerateAssistantMessage?: (messageId: string) => void;
  isStreaming?: boolean;
  streamThinking?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  allMessages,
  userDisplayName,
  userAvatarUrl,
  onOpenArtifact,
  onQuickPrompt,
  isEphemeral,
  skills = [],
  allowRegeneration = true,
  allowEditingUserMessages = true,
  onSwitchSibling,
  onEditUserMessage,
  onRegenerateAssistantMessage,
  isStreaming,
  streamThinking,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const conversationPool = allMessages && allMessages.length > 0 ? allMessages : messages;

  // Auto-scroll on message updates
  useEffect(() => {
    if (!showScrollBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showScrollBottom]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 150);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative flex flex-col justify-between"
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto my-auto">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mb-4 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            How can I help you today?
          </h2>

          <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
            {isEphemeral
              ? 'This is a private incognito session. Messages and artifacts created in this conversation will not be saved to history.'
              : 'Ask questions, run Python code in the safe sandbox, brainstorm ideas, or generate interactive diagrams and artifacts.'}
          </p>

          {/* Quick Suggestions Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
            <button
              onClick={() =>
                onQuickPrompt?.(
                  'Write a comprehensive system architecture document with a Mermaid flowchart showing a microservices setup.'
                )
              }
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 font-medium text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 mb-1">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>Architecture Diagram</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Generate an architectural report with an embedded Mermaid.js flowchart.
              </p>
            </button>

            <button
              onClick={() =>
                onQuickPrompt?.(
                  'Execute a Python script using the sandbox tool to calculate the first 20 Fibonacci numbers and find their primes.'
                )
              }
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 font-medium text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 mb-1">
                <Terminal className="w-3.5 h-3.5 text-sky-500" />
                <span>Python Sandbox</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Run client-side sandboxed Python code to compute Fibonacci numbers.
              </p>
            </button>

            <button
              onClick={() =>
                onQuickPrompt?.(
                  'Explain the Black-Scholes formula for European options, including KaTeX mathematical formulas.'
                )
              }
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 font-medium text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 mb-1">
                <Compass className="w-3.5 h-3.5 text-indigo-500" />
                <span>KaTeX Math Formula</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Explain financial options using rich inline and block KaTeX formulas.
              </p>
            </button>

            <button
              onClick={() =>
                onQuickPrompt?.(
                  'Create a markdown artifact titled "Project Roadmap" with milestones, task lists, and release phases.'
                )
              }
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center gap-2 font-medium text-xs text-slate-800 dark:text-slate-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 mb-1">
                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                <span>Create Artifact</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                Generate a standalone document artifact viewable in the side drawer.
              </p>
            </button>
          </div>
        </div>
      ) : (
        <div className="py-4 max-w-3xl mx-auto w-full">
          {messages.map((msg, idx) => {
            const { siblings, currentIndex } = getMessageSiblings(conversationPool, msg.id);
            const isLastMessage = idx === messages.length - 1;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                userDisplayName={userDisplayName}
                userAvatarUrl={userAvatarUrl}
                onOpenArtifact={onOpenArtifact}
                allowRegeneration={allowRegeneration}
                allowEditingUserMessages={allowEditingUserMessages}
                siblings={siblings}
                currentSiblingIndex={currentIndex}
                onSwitchSibling={onSwitchSibling}
                onEditUserMessage={onEditUserMessage}
                onRegenerateAssistantMessage={onRegenerateAssistantMessage}
                isStreaming={isStreaming && isLastMessage && msg.role === 'assistant'}
                streamThinking={streamThinking}
              />
            );
          })}
          <div ref={bottomRef} className="h-4" />
        </div>
      )}

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-8 p-2 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-all z-20"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
