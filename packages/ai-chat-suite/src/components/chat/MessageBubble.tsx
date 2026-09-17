import React, { useState } from 'react';
import {
  User,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Brain,
  AlertCircle,
  Copy,
  Check,
  Edit2,
  RotateCw,
  Loader2,
} from 'lucide-react';
import { ChatMessage, VirtualArtifact } from '../../types/chat';
import { MarkdownViewer } from '../../rendering/MarkdownViewer';
import { ToolCallCard } from './ToolCallCard';
import { ArtifactCard } from './ArtifactCard';
import { ExecutionTimeline } from './ExecutionTimeline';

export interface MessageBubbleProps {
  message: ChatMessage;
  userAvatarUrl?: string;
  userDisplayName?: string;
  onOpenArtifact?: (artifactId: string) => void;
  allowRegeneration?: boolean;
  allowEditingUserMessages?: boolean;
  siblings?: string[];
  currentSiblingIndex?: number;
  onSwitchSibling?: (siblingId: string) => void;
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  onRegenerateAssistantMessage?: (messageId: string) => void;
  isStreaming?: boolean;
  streamThinking?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  userAvatarUrl,
  userDisplayName = 'You',
  onOpenArtifact,
  allowRegeneration = true,
  allowEditingUserMessages = true,
  siblings = [message.id],
  currentSiblingIndex = 0,
  onSwitchSibling,
  onEditUserMessage,
  onRegenerateAssistantMessage,
  isStreaming = false,
  streamThinking = false,
}) => {
  const [userToggledThinking, setUserToggledThinking] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  // Check if assistant is currently executing tools or multi-step tasks
  const hasRunningTools = Boolean(
    message.toolCalls?.some((tc) => tc.status === 'running') ||
    message.executionBlocks?.some(
      (b) => b.type === 'tool-group' && b.group.steps.some((s) => s.status === 'running')
    )
  );

  // Check if final response text is actively streaming
  const lastBlock = message.executionBlocks?.[message.executionBlocks.length - 1];
  const isStreamingFinalResponse = Boolean(
    lastBlock?.type === 'response-text' && lastBlock.content.trim().length > 0
  );

  // Active thinking indicator: active while streaming whenever not actively outputting the final response text,
  // or when tools are running or between multi-turn execution steps.
  const isThinkingActive = Boolean(
    isStreaming && (!isStreamingFinalResponse || hasRunningTools)
  );

  // If user explicitly toggled, respect their choice; otherwise auto-expand if streamThinking opt-in is enabled
  const thinkingExpanded =
    userToggledThinking !== null
      ? userToggledThinking
      : Boolean(streamThinking);

  // Persist thinking box whenever real thinking content exists, or while actively streaming with streamThinking
  const showThinkingBox = Boolean(
    (message.thinking && message.thinking.trim().length > 0) ||
    (streamThinking && isStreaming && isThinkingActive)
  );

  const isUser = message.role === 'user';
  const hasSiblings = siblings.length > 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = () => {
    if (editContent.trim() && editContent.trim() !== message.content) {
      onEditUserMessage?.(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handlePrevSibling = () => {
    if (currentSiblingIndex > 0) {
      onSwitchSibling?.(siblings[currentSiblingIndex - 1]);
    }
  };

  const handleNextSibling = () => {
    if (currentSiblingIndex < siblings.length - 1) {
      onSwitchSibling?.(siblings[currentSiblingIndex + 1]);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-4 px-4 group">
        <div className="flex gap-3 max-w-[88%] md:max-w-[78%]">
          <div className="flex flex-col items-end min-w-0 max-w-full">
            {isEditing ? (
              <div className="w-full rounded-2xl p-3 bg-white dark:bg-slate-900 border border-amber-500 shadow-md">
                <textarea
                  autoFocus
                  rows={3}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 focus:outline-none resize-none leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(message.content);
                    }}
                    className="px-2.5 py-1 text-xs rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    className="px-3 py-1 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                  >
                    Save & Submit
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm leading-relaxed select-text shadow-sm overflow-hidden w-full">
                <MarkdownViewer content={message.content} />
              </div>
            )}

            {/* User message actions & branch cycler */}
            {/* User message actions & branch cycler */}
            <div className="flex items-center justify-end gap-2 mt-1 px-1 text-[11px] text-slate-400">
              {/* Sibling Cycler (OpenWebUI Style) */}
              {hasSiblings && (
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300">
                  <button
                    onClick={handlePrevSibling}
                    disabled={currentSiblingIndex === 0}
                    className="p-0.5 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-inherit"
                    title="Previous version"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <span>
                    {currentSiblingIndex + 1}/{siblings.length}
                  </span>
                  <button
                    onClick={handleNextSibling}
                    disabled={currentSiblingIndex === siblings.length - 1}
                    className="p-0.5 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-inherit"
                    title="Next version"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Action buttons (only visible on hover, zero width impact when hidden) */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {allowEditingUserMessages && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="hover:text-amber-600 dark:hover:text-amber-400 p-0.5"
                    title="Edit message"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}

                <button
                  onClick={handleCopy}
                  className="hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                  title="Copy text"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <span className="text-[10px]">
                {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <div className="w-7 h-7 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-semibold flex-shrink-0 mt-0.5 overflow-hidden">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={userDisplayName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div className="my-6 px-4 group">
      <div className="flex gap-3.5 max-w-[95%] md:max-w-[88%]">
        {/* Assistant Avatar */}
        <div className="w-7 h-7 rounded-full bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Thinking Collapsible Accordion (DeepSeek, Claude 3.7, Qwen, etc.) */}
          {showThinkingBox && (
            <div className="mb-3 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-900/40 overflow-hidden text-xs shadow-xs">
              <button
                type="button"
                onClick={() => setUserToggledThinking(!thinkingExpanded)}
                className="w-full px-3.5 py-2 flex items-center justify-between text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Brain
                    className={`w-3.5 h-3.5 ${
                      isThinkingActive ? 'text-amber-500 animate-pulse' : 'text-amber-500/80'
                    }`}
                  />
                  {isThinkingActive ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                      <span>Thinking...</span>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-300">Thought Process</span>
                      {message.thinking && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                          ({message.thinking.trim().split(/\s+/).length} words)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">
                    {thinkingExpanded ? 'Hide' : 'Show'}
                  </span>
                  {thinkingExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
              </button>

              {thinkingExpanded && (
                <div className="px-3.5 py-2.5 border-t border-slate-200/60 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-950/40 text-slate-600 dark:text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap select-text max-h-80 overflow-y-auto">
                  {message.thinking ? (
                    <>
                      <span>{message.thinking}</span>
                      {isThinkingActive && (
                        <span className="inline-block w-1.5 h-3 ml-1 bg-amber-500 animate-pulse align-middle" />
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 py-1 text-slate-400 italic">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                      <span>Formulating reasoning and plan...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chronological Execution Blocks (Claude-style) */}
          {message.executionBlocks && message.executionBlocks.length > 0 ? (
            <div className="space-y-2 select-text">
              {/* 1. Chronological content blocks (commentary, tool-groups, response-text) */}
              {message.executionBlocks
                .filter((block) => block.type !== 'artifact-card')
                .map((block) => {
                  if (block.type === 'commentary') {
                    return (
                      <div
                        key={block.id}
                        className="text-sm text-slate-800 dark:text-slate-200 py-1 leading-relaxed select-text"
                      >
                        <MarkdownViewer content={block.content} />
                      </div>
                    );
                  }
                  if (block.type === 'tool-group') {
                    return (
                      <ExecutionTimeline
                        key={block.id}
                        group={block.group}
                        onOpenArtifact={onOpenArtifact}
                      />
                    );
                  }
                  if (block.type === 'response-text') {
                    return (
                      <div key={block.id} className="select-text">
                        <MarkdownViewer content={block.content} />
                      </div>
                    );
                  }
                  return null;
                })}

              {/* 2. Pinned Artifact Cards at the absolute bottom of message */}
              {(() => {
                const cardBlocks = message.executionBlocks.filter(
                  (b) => b.type === 'artifact-card'
                ) as { type: 'artifact-card'; id: string; artifact: VirtualArtifact }[];
                const seen = new Set<string>();
                const bottomCards: VirtualArtifact[] = [];

                for (const cb of cardBlocks) {
                  if (!seen.has(cb.artifact.id)) {
                    seen.add(cb.artifact.id);
                    bottomCards.push(cb.artifact);
                  }
                }
                if (message.artifacts) {
                  for (const art of message.artifacts) {
                    if (!seen.has(art.id)) {
                      seen.add(art.id);
                      bottomCards.push(art);
                    }
                  }
                }

                if (bottomCards.length === 0) return null;
                return (
                  <div className="mt-2 space-y-2">
                    {bottomCards.map((art) => (
                      <ArtifactCard
                        key={art.id}
                        artifact={art}
                        onOpen={(id) => onOpenArtifact?.(id)}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* Legacy: Tool Invocations */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="my-2 space-y-1">
                  {message.toolCalls.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}

              {/* Legacy: Main Markdown Content */}
              {message.content ? (
                <div className="select-text">
                  <MarkdownViewer content={message.content} />
                </div>
              ) : (
                !message.toolCalls?.length && !showThinkingBox && (
                  <div className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 w-fit my-1">
                    <Brain className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    <span className="font-medium">Thinking...</span>
                    <span className="flex items-center gap-1 ml-0.5">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce" />
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                )
              )}

              {/* Legacy: Created Artifacts */}
              {message.artifacts && message.artifacts.length > 0 && (
                <div className="my-2 space-y-1">
                  {message.artifacts.map((art) => (
                    <ArtifactCard
                      key={art.id}
                      artifact={art}
                      onOpen={(id) => onOpenArtifact?.(id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Error Banner */}
          {message.error && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{message.error}</span>
            </div>
          )}

          {/* Footer Actions, Branch Cycler, and Regeneration */}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-[10px]">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            {/* Sibling Cycler for Assistant Messages */}
            {hasSiblings && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-300">
                <button
                  onClick={handlePrevSibling}
                  disabled={currentSiblingIndex === 0}
                  className="p-0.5 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-inherit"
                  title="Previous response"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span>
                  {currentSiblingIndex + 1}/{siblings.length}
                </span>
                <button
                  onClick={handleNextSibling}
                  disabled={currentSiblingIndex === siblings.length - 1}
                  className="p-0.5 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-inherit"
                  title="Next response"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Hover actions (zero layout footprint when hidden) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Regenerate Button */}
              {allowRegeneration && (
                <button
                  onClick={() => onRegenerateAssistantMessage?.(message.id)}
                  className="flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 p-0.5"
                  title="Regenerate response"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                title="Copy response"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
