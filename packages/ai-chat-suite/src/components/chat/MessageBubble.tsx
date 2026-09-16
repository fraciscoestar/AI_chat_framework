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
}) => {
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

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
              {/* Legacy: Thinking Collapsible Accordion */}
              {message.thinking && (
                <div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setThinkingExpanded(!thinkingExpanded)}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Brain className="w-3.5 h-3.5 text-amber-500" />
                      <span>Thought Process</span>
                    </div>
                    {thinkingExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {thinkingExpanded && (
                    <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-xs italic leading-relaxed whitespace-pre-wrap font-serif">
                      {message.thinking}
                    </div>
                  )}
                </div>
              )}

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
                !message.toolCalls?.length && (
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse delay-150" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse delay-300" />
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
