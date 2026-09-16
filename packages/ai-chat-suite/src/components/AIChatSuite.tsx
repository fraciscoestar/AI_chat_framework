import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChatMessage,
  Conversation,
  Folder,
  ChatPayload,
  ModelOption,
  ExecutionBlock,
  ExecutionGroup,
  ExecutionStep,
  ExecutionStepKind,
  getActiveBranch,
  findDeepestLeafId,
} from '../types/chat';
import { formatExecutionSummary } from './chat/ExecutionTimeline';
import { ChatStreamEvent, StreamHandler } from '../types/stream';
import { SkillDefinition } from '../types/skills';
import { ArtifactType, VirtualArtifact } from '../types/workspace';
import { ChatStorageAdapter } from '../types/storage';
import { ToolDefinition } from '../types/tools';
import { RendererRegistry } from '../types/renderers';
import { IndexedDBStorageAdapter } from '../storage/indexedDbAdapter';
import { MemoryStorageAdapter } from '../storage/memoryAdapter';
import { VirtualFileSystem } from '../workspace/vfs';
import { PythonRunner } from '../workspace/pythonRunner';
import { SkillManager } from '../skills/skillManager';
import { ToolManager } from '../tools/toolManager';
import { RendererProvider } from '../rendering/RendererRegistry';

import { LeftSidebar } from './layout/LeftSidebar';
import { RightSidebar } from './layout/RightSidebar';
import { Header } from './layout/Header';
import { MessageList } from './chat/MessageList';
import { ChatInput } from './chat/ChatInput';
import { SkillsModal } from './skills/SkillsModal';

export interface AIChatSuiteProps {
  userId: string;
  userDisplayName?: string;
  userAvatarUrl?: string;

  // Streaming AI function supplied by parent project
  onSendMessage: StreamHandler;

  // Persistence adapter (defaults to IndexedDB)
  storageAdapter?: ChatStorageAdapter;

  // Skills supplied by parent project
  skills?: SkillDefinition[];

  // Custom tools supplied by parent project
  tools?: ToolDefinition[];

  // Extensible custom renderers (e.g. { kicad: KicadViewer })
  renderers?: RendererRegistry;

  // Feature flags
  pythonExecutionEnabled?: boolean;
  allowEphemeralChats?: boolean;

  // Model selection (parent controlled or options list)
  models?: ModelOption[];
  selectedModelId?: string;
  onSelectModel?: (modelId: string) => void;
  selectedEffortId?: string;
  onSelectEffort?: (effortId: string) => void;
  onAddAttachment?: () => void;

  // Branching & regeneration flags (opt-in)
  allowRegeneration?: boolean;
  allowEditingUserMessages?: boolean;

  // Theming & layout
  theme?: 'dark' | 'light' | 'system';
  className?: string;
}

export const AIChatSuite: React.FC<AIChatSuiteProps> = ({
  userId,
  userDisplayName = 'User',
  userAvatarUrl,
  onSendMessage,
  storageAdapter: customStorageAdapter,
  skills = [],
  tools = [],
  renderers = {},
  pythonExecutionEnabled = true,
  allowEphemeralChats = true,
  models = [],
  selectedModelId: controlledSelectedModelId,
  onSelectModel,
  selectedEffortId: controlledSelectedEffortId,
  onSelectEffort,
  onAddAttachment,
  allowRegeneration = false,
  allowEditingUserMessages = false,
  theme = 'system',
  className = '',
}) => {
  // Storage adapter fallback to IndexedDB in browser, Memory in SSR
  const storage = useMemo<ChatStorageAdapter>(() => {
    if (customStorageAdapter) return customStorageAdapter;
    if (typeof window !== 'undefined') return new IndexedDBStorageAdapter();
    return new MemoryStorageAdapter();
  }, [customStorageAdapter]);

  // VFS & Python Runner
  const vfs = useMemo(() => new VirtualFileSystem(userId, storage), [userId, storage]);
  const pythonRunner = useMemo(
    () => (pythonExecutionEnabled ? new PythonRunner(vfs) : undefined),
    [pythonExecutionEnabled, vfs]
  );

  // Skill Manager
  const skillManager = useMemo(() => new SkillManager(skills), [skills]);
  const skillSummaries = useMemo(() => skillManager.getSummaries(), [skillManager]);

  // Tool Manager
  const toolManager = useMemo(() => {
    const tm = new ToolManager({
      vfs,
      pythonRunner,
      skillManager,
    });
    return tm;
  }, [vfs, pythonRunner, skillManager]);

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draftConversation, setDraftConversation] = useState<Conversation | null>(null);

  // Drawers
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState<string | undefined>(undefined);
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Active conversation object
  const activeConversation = useMemo(() => {
    if (draftConversation && draftConversation.id === activeConversationId) {
      return draftConversation;
    }
    return conversations.find((c) => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId, draftConversation]);

  // Model selection state
  const [internalModelId, setInternalModelId] = useState<string | undefined>(
    controlledSelectedModelId || (models && models.length > 0 ? models[0].id : undefined)
  );

  useEffect(() => {
    if (controlledSelectedModelId !== undefined) {
      setInternalModelId(controlledSelectedModelId);
    }
  }, [controlledSelectedModelId]);

  const handleSelectModel = useCallback(
    (id: string) => {
      setInternalModelId(id);
      onSelectModel?.(id);
    },
    [onSelectModel]
  );

  // Effort selection state
  const [internalEffortId, setInternalEffortId] = useState<string | undefined>(
    controlledSelectedEffortId
  );

  useEffect(() => {
    if (controlledSelectedEffortId !== undefined) {
      setInternalEffortId(controlledSelectedEffortId);
    }
  }, [controlledSelectedEffortId]);

  const handleSelectEffort = useCallback(
    (effortId: string) => {
      setInternalEffortId(effortId);
      onSelectEffort?.(effortId);
    },
    [onSelectEffort]
  );

  // Active branch linear messages
  const activeBranchMessages = useMemo(() => {
    return getActiveBranch(activeConversation?.messages || [], activeConversation?.currentLeafId);
  }, [activeConversation?.messages, activeConversation?.currentLeafId]);

  // Load conversations and folders on mount or userId change
  useEffect(() => {
    let mounted = true;

    async function initData() {
      try {
        const [loadedConvs, loadedFolders] = await Promise.all([
          storage.getConversations(userId),
          storage.getFolders(userId),
        ]);

        if (!mounted) return;

        // Filter out any empty or ephemeral conversations from persistence
        const validConvs = loadedConvs.filter(
          (c) => !c.isEphemeral && c.messages && c.messages.length > 0
        );

        setConversations(validConvs);
        setFolders(loadedFolders);

        if (validConvs.length > 0) {
          setActiveConversationId(validConvs[0].id);
        } else {
          // Initialize a fresh uncommitted draft chat
          const initialDraft: Conversation = {
            id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: 'New Chat',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            folderId: null,
            isEphemeral: false,
            messages: [],
            artifacts: [],
          };
          setDraftConversation(initialDraft);
          setActiveConversationId(initialDraft.id);
        }
      } catch (err) {
        console.error('[AIChatSuite] Error initializing data:', err);
      }
    }

    initData();

    return () => {
      mounted = false;
    };
  }, [userId, storage]);

  // Handle creating a new conversation (keeps it as uncommitted draft until message sent)
  const handleNewConversation = useCallback(
    (isEphemeral = false) => {
      const draft: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: isEphemeral ? 'Incognito Chat' : 'New Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        folderId: null,
        isEphemeral,
        messages: [],
        artifacts: [],
      };

      setDraftConversation(draft);
      setActiveConversationId(draft.id);
      setActiveArtifactId(undefined);
      setRightDrawerOpen(false);
    },
    []
  );

  // Switch conversation
  const handleSelectConversation = useCallback(
    (id: string) => {
      // Discard empty draft if user navigates to an existing conversation
      if (draftConversation && draftConversation.messages.length === 0) {
        setDraftConversation(null);
      }
      setActiveConversationId(id);
      setActiveArtifactId(undefined);
    },
    [draftConversation]
  );

  // Delete conversation
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      if (draftConversation && draftConversation.id === id) {
        setDraftConversation(null);
      }
      await storage.deleteConversation(userId, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          handleNewConversation(false);
        }
      }
    },
    [userId, storage, activeConversationId, conversations, draftConversation, handleNewConversation]
  );

  // Rename conversation
  const handleRenameConversation = useCallback(
    async (id: string, newTitle: string) => {
      if (draftConversation && draftConversation.id === id) {
        setDraftConversation({ ...draftConversation, title: newTitle, updatedAt: Date.now() });
        return;
      }
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return;
      const updated = { ...conv, title: newTitle, updatedAt: Date.now() };
      if (!conv.isEphemeral) {
        await storage.saveConversation(userId, updated);
      }
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
    },
    [userId, storage, conversations, draftConversation]
  );

  // Move conversation to folder
  const handleMoveConversationToFolder = useCallback(
    async (convId: string, folderId: string | null) => {
      if (draftConversation && draftConversation.id === convId) {
        setDraftConversation({ ...draftConversation, folderId, updatedAt: Date.now() });
        return;
      }
      const conv = conversations.find((c) => c.id === convId);
      if (!conv) return;
      const updated = { ...conv, folderId, updatedAt: Date.now() };
      if (!conv.isEphemeral) {
        await storage.saveConversation(userId, updated);
      }
      setConversations((prev) => prev.map((c) => (c.id === convId ? updated : c)));
    },
    [userId, storage, conversations, draftConversation]
  );

  // Folder CRUD
  const handleCreateFolder = useCallback(
    async (name: string) => {
      const newFolder: Folder = {
        id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storage.saveFolder(userId, newFolder);
      setFolders((prev) => [...prev, newFolder]);
    },
    [userId, storage]
  );

  const handleRenameFolder = useCallback(
    async (id: string, name: string) => {
      const folder = folders.find((f) => f.id === id);
      if (!folder) return;
      const updated = { ...folder, name, updatedAt: Date.now() };
      await storage.saveFolder(userId, updated);
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    },
    [userId, storage, folders]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      await storage.deleteFolder(userId, id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setConversations((prev) =>
        prev.map((c) => (c.folderId === id ? { ...c, folderId: null } : c))
      );
    },
    [userId, storage]
  );

  const updateConversationMessages = useCallback(
    (
      convId: string,
      isEphemeral: boolean | undefined,
      updater: (msgs: ChatMessage[]) => ChatMessage[]
    ) => {
      if (isEphemeral) {
        setDraftConversation((prev) =>
          prev && prev.id === convId ? { ...prev, messages: updater(prev.messages) } : prev
        );
      } else {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, messages: updater(c.messages) } : c))
        );
      }
    },
    []
  );

  // Common streaming execution handler
  const executeStream = useCallback(
    async (
      convId: string,
      isEphemeral: boolean | undefined,
      assistantMessageId: string,
      messagesForPrompt: ChatMessage[],
      currentPromptText: string
    ) => {
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const payload: ChatPayload = {
        conversationId: convId,
        messages: messagesForPrompt,
        currentPrompt: currentPromptText,
        skills: skillSummaries,
        isEphemeral,
        model: internalModelId,
        effort: internalEffortId,
      };

      const executionBlocks: ExecutionBlock[] = [];

      try {
        const streamResult = await onSendMessage(payload);
        let accumulatedText = '';
        let accumulatedThinking = '';

        const getActiveToolGroup = (): ExecutionGroup => {
          const last = executionBlocks[executionBlocks.length - 1];
          if (last && last.type === 'tool-group' && !last.group.isCompleted) {
            return last.group;
          }
          const newGroup: ExecutionGroup = {
            id: `group_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            summary: '',
            steps: [],
            isCompleted: false,
          };
          executionBlocks.push({
            type: 'tool-group',
            id: newGroup.id,
            group: newGroup,
          });
          return newGroup;
        };

        const finalizeActiveToolGroup = () => {
          const last = executionBlocks[executionBlocks.length - 1];
          if (last && last.type === 'tool-group' && !last.group.isCompleted) {
            last.group.isCompleted = true;
            last.group.summary = formatExecutionSummary(last.group.steps, 'en');
          }
        };

        for await (const event of streamResult) {
          if (abortController.signal.aborted) break;

          switch (event.type) {
            case 'text-delta': {
              accumulatedText += event.delta;
              finalizeActiveToolGroup();
              const lastBlock = executionBlocks[executionBlocks.length - 1];
              if (lastBlock && lastBlock.type === 'response-text') {
                lastBlock.content += event.delta;
              } else {
                executionBlocks.push({
                  type: 'response-text',
                  id: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  content: event.delta,
                });
              }
              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: accumulatedText, executionBlocks: [...executionBlocks] }
                    : m
                )
              );
              break;
            }

            case 'commentary-delta': {
              finalizeActiveToolGroup();
              const lastBlock = executionBlocks[executionBlocks.length - 1];
              if (lastBlock && lastBlock.type === 'commentary') {
                lastBlock.content += event.delta;
              } else {
                executionBlocks.push({
                  type: 'commentary',
                  id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  content: event.delta,
                });
              }
              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, executionBlocks: [...executionBlocks] }
                    : m
                )
              );
              break;
            }

            case 'thinking-delta': {
              accumulatedThinking += event.delta;
              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantMessageId ? { ...m, thinking: accumulatedThinking } : m
                )
              );
              break;
            }

            case 'tool-call': {
              // If preceding block was response-text before this tool call, it acts as commentary
              const lastBlock = executionBlocks[executionBlocks.length - 1];
              if (lastBlock && lastBlock.type === 'response-text') {
                (lastBlock as { type: string }).type = 'commentary';
              }

              const newToolCall = {
                id: event.id,
                name: event.name,
                args: event.args,
                status: 'running' as const,
              };

              const group = getActiveToolGroup();

              let kind: ExecutionStepKind = 'tool';
              let title = String(event.args.title || event.args.description || event.args.reason || '');
              let filename: string | undefined = undefined;

              if (event.args.path) {
                filename = String(event.args.path).split('/').pop();
              }

              if (event.name === 'workspace_read_file') {
                kind = 'read';
                if (!title) title = filename ? `View ${filename}` : 'Read file';
              } else if (event.name === 'workspace_edit_file') {
                kind = 'edit';
                if (!title) title = filename ? `Edit ${filename}` : 'Edit file';
              } else if (event.name === 'workspace_write_file') {
                kind = 'edit';
                if (!title) title = filename ? `Create ${filename}` : 'Create file';
              } else if (event.name === 'workspace_present_file') {
                kind = 'present';
                title = 'Presented file';
              } else if (event.name === 'python_eval') {
                kind = 'command';
                if (!title) title = String(event.args.command || event.args.name || 'Execute Python script');
              } else if (event.name === 'agent_note' || event.name === 'note') {
                kind = 'note';
                title = String(event.args.note || event.args.text || title || 'Note');
              } else {
                kind = 'tool';
                if (!title) title = `Execute ${event.name}`;
              }

              const step: ExecutionStep = {
                id: `step_${event.id}`,
                kind,
                title,
                filename,
                status: 'running',
                toolCallId: event.id,
                timestamp: Date.now(),
              };
              group.steps.push(step);
              group.summary = formatExecutionSummary(group.steps, 'en');

              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  const existing = m.toolCalls || [];
                  return {
                    ...m,
                    toolCalls: [...existing, newToolCall],
                    executionBlocks: [...executionBlocks],
                  };
                })
              );

              // Client-side tool execution
              try {
                const execResult = await toolManager.executeTool({
                  id: event.id,
                  name: event.name,
                  args: event.args,
                  userId,
                  conversationId: convId,
                });

                // Update step in execution blocks
                for (const b of executionBlocks) {
                  if (b.type === 'tool-group') {
                    const s = b.group.steps.find((st) => st.toolCallId === event.id || st.id === `step_${event.id}`);
                    if (s) {
                      s.status = execResult.isError ? 'error' : 'completed';
                      if (execResult.result && typeof execResult.result === 'object') {
                        const resObj = execResult.result as { diff?: { added: number; removed: number } };
                        if (resObj.diff) {
                          s.diff = resObj.diff;
                        }
                      }
                      b.group.summary = formatExecutionSummary(b.group.steps, 'en');
                      break;
                    }
                  }
                }

                // If tool presented a file via workspace_present_file, surface artifact in drawer and assistant message
                if (event.name === 'workspace_present_file' && execResult.result && !execResult.isError) {
                  try {
                    const artResult = execResult.result as { artifactId: string; path: string; title: string };
                    const content = await vfs.readFile(artResult.path);
                    const file = await vfs.stat(artResult.path);
                    const filename = artResult.path.split('/').pop() || 'file';
                    const ext = filename.split('.').pop()?.toLowerCase() || '';
                    const language =
                      ext === 'py' ? 'python' :
                      ext === 'js' ? 'javascript' :
                      ext === 'ts' ? 'typescript' :
                      ext === 'tsx' ? 'tsx' :
                      ext === 'jsx' ? 'jsx' :
                      ext === 'json' ? 'json' :
                      ext === 'html' ? 'html' :
                      ext === 'css' ? 'css' :
                      ext === 'md' ? 'markdown' :
                      ext === 'kicad_sch' ? 'kicad_sch' :
                      'text';
                    const artifactType: ArtifactType =
                      language === 'markdown' ? 'document' :
                      language === 'html' ? 'application' :
                      'code';

                    const presentedArt: VirtualArtifact = {
                      id: artResult.artifactId,
                      title: artResult.title || filename,
                      filename,
                      language,
                      type: artifactType,
                      content,
                      createdAt: file ? file.updatedAt : Date.now(),
                      updatedAt: file ? file.updatedAt : Date.now(),
                      conversationId: convId,
                    };

                    setActiveArtifactId(presentedArt.id);
                    setRightDrawerOpen(true);

                    // Add artifact card to execution blocks pinned at the bottom
                    if (!executionBlocks.some((b) => b.type === 'artifact-card' && b.artifact.id === presentedArt.id)) {
                      executionBlocks.push({
                        type: 'artifact-card',
                        id: `card_${presentedArt.id}`,
                        artifact: presentedArt,
                      });
                    }

                    if (isEphemeral) {
                      setDraftConversation((prev) => {
                        if (!prev) return prev;
                        const existing = prev.artifacts || [];
                        return {
                          ...prev,
                          artifacts: [...existing.filter((a) => a.id !== presentedArt.id), presentedArt],
                        };
                      });
                    } else {
                      setConversations((prev) =>
                        prev.map((c) => {
                          if (c.id !== convId) return c;
                          const existing = c.artifacts || [];
                          return {
                            ...c,
                            artifacts: [...existing.filter((a) => a.id !== presentedArt.id), presentedArt],
                          };
                        })
                      );
                    }

                    updateConversationMessages(convId, isEphemeral, (msgs) =>
                      msgs.map((m) => {
                        if (m.id !== assistantMessageId) return m;
                        const existingArts = m.artifacts || [];
                        return {
                          ...m,
                          artifacts: [...existingArts.filter((a) => a.id !== presentedArt.id), presentedArt],
                          executionBlocks: [...executionBlocks],
                        };
                      })
                    );
                  } catch (presentErr) {
                    console.error('[AIChatSuite] Error presenting file artifact:', presentErr);
                  }
                }

                // If tool edited or modified an existing presented artifact via workspace_edit_file or workspace_write_file
                if (
                  (event.name === 'workspace_edit_file' || event.name === 'workspace_write_file') &&
                  execResult.result &&
                  !execResult.isError
                ) {
                  try {
                    const pathStr = String(event.args.path || '');
                    const filename = pathStr.split('/').pop() || '';
                    const newContent = await vfs.readFile(pathStr);
                    const updateArtifactList = (arts: VirtualArtifact[] = []) =>
                      arts.map((a) => {
                        if (a.filename === filename || a.id.includes(pathStr.replace(/[^a-zA-Z0-9_-]/g, '_'))) {
                          return { ...a, content: newContent, updatedAt: Date.now() };
                        }
                        return a;
                      });

                    if (isEphemeral) {
                      setDraftConversation((prev) => (prev ? { ...prev, artifacts: updateArtifactList(prev.artifacts) } : prev));
                    } else {
                      setConversations((prev) =>
                        prev.map((c) => (c.id === convId ? { ...c, artifacts: updateArtifactList(c.artifacts) } : c))
                      );
                    }

                    // Also update content in any artifact-card execution block
                    for (const b of executionBlocks) {
                      if (b.type === 'artifact-card' && (b.artifact.filename === filename || b.artifact.id.includes(pathStr.replace(/[^a-zA-Z0-9_-]/g, '_')))) {
                        b.artifact.content = newContent;
                        b.artifact.updatedAt = Date.now();
                      }
                    }

                    updateConversationMessages(convId, isEphemeral, (msgs) =>
                      msgs.map((m) => {
                        if (!m.artifacts || m.artifacts.length === 0) return m;
                        return { ...m, artifacts: updateArtifactList(m.artifacts), executionBlocks: [...executionBlocks] };
                      })
                    );
                  } catch {
                    // Ignore read errors
                  }
                }

                updateConversationMessages(convId, isEphemeral, (msgs) =>
                  msgs.map((m) => {
                    if (m.id !== assistantMessageId) return m;
                    const updatedTools = (m.toolCalls || []).map((tc) =>
                      tc.id === event.id
                        ? {
                            ...tc,
                            status: (execResult.isError ? 'error' : 'completed') as
                              | 'error'
                              | 'completed',
                            result: execResult.result,
                            error: execResult.error,
                          }
                        : tc
                    );
                    return { ...m, toolCalls: updatedTools, executionBlocks: [...executionBlocks] };
                  })
                );
              } catch (execErr) {
                console.error('[AIChatSuite] Client tool execution error:', execErr);
              }
              break;
            }

            case 'tool-result': {
              for (const b of executionBlocks) {
                if (b.type === 'tool-group') {
                  const s = b.group.steps.find((st) => st.toolCallId === event.id || st.id === `step_${event.id}`);
                  if (s) {
                    s.status = event.isError ? 'error' : 'completed';
                    if (event.result && typeof event.result === 'object') {
                      const resObj = event.result as { diff?: { added: number; removed: number } };
                      if (resObj.diff) {
                        s.diff = resObj.diff;
                      }
                    }
                    b.group.summary = formatExecutionSummary(b.group.steps, 'en');
                    break;
                  }
                }
              }

              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  const updatedTools = (m.toolCalls || []).map((tc) =>
                    tc.id === event.id
                      ? {
                          ...tc,
                          status: (event.isError ? 'error' : 'completed') as 'error' | 'completed',
                          result: event.result,
                        }
                      : tc
                  );
                  return { ...m, toolCalls: updatedTools, executionBlocks: [...executionBlocks] };
                })
              );
              break;
            }

            case 'artifact-create': {
              const art = event.artifact;
              setActiveArtifactId(art.id);
              setRightDrawerOpen(true);

              if (!executionBlocks.some((b) => b.type === 'artifact-card' && b.artifact.id === art.id)) {
                executionBlocks.push({
                  type: 'artifact-card',
                  id: `card_${art.id}`,
                  artifact: art,
                });
              }

              if (isEphemeral) {
                setDraftConversation((prev) => {
                  if (!prev) return prev;
                  const existing = prev.artifacts || [];
                  return {
                    ...prev,
                    artifacts: [...existing.filter((a) => a.id !== art.id), art],
                  };
                });
              } else {
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id !== convId) return c;
                    const existing = c.artifacts || [];
                    const updatedArtifacts = [...existing.filter((a) => a.id !== art.id), art];
                    return { ...c, artifacts: updatedArtifacts };
                  })
                );
              }

              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  const existingArts = m.artifacts || [];
                  return {
                    ...m,
                    artifacts: [...existingArts.filter((a) => a.id !== art.id), art],
                    executionBlocks: [...executionBlocks],
                  };
                })
              );
              break;
            }

            case 'artifact-update': {
              const updateArtifactList = (arts: VirtualArtifact[] = []) =>
                arts.map((a) => {
                  if (a.id === event.artifactId) {
                    const newContent =
                      event.content !== undefined ? event.content : a.content + (event.delta || '');
                    return { ...a, content: newContent, updatedAt: Date.now() };
                  }
                  return a;
                });

              if (isEphemeral) {
                setDraftConversation((prev) =>
                  prev ? { ...prev, artifacts: updateArtifactList(prev.artifacts) } : prev
                );
              } else {
                setConversations((prev) =>
                  prev.map((c) => (c.id === convId ? { ...c, artifacts: updateArtifactList(c.artifacts) } : c))
                );
              }
              break;
            }

            case 'error': {
              updateConversationMessages(convId, isEphemeral, (msgs) =>
                msgs.map((m) =>
                  m.id === assistantMessageId ? { ...m, error: event.message } : m
                )
              );
              break;
            }

            case 'done':
              break;
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown streaming error';
        updateConversationMessages(convId, isEphemeral, (msgs) =>
          msgs.map((m) =>
            m.id === assistantMessageId ? { ...m, error: errorMsg } : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;

        // Finalize all open tool groups
        for (const b of executionBlocks) {
          if (b.type === 'tool-group') {
            b.group.isCompleted = true;
            b.group.summary = formatExecutionSummary(b.group.steps, 'en');
          }
        }

        updateConversationMessages(convId, isEphemeral, (msgs) =>
          msgs.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  executionBlocks: [...executionBlocks],
                }
              : m
          )
        );

        // Persist completed conversation (NEVER persist if ephemeral!)
        if (!isEphemeral) {
          setConversations((prev) => {
            const finalConv = prev.find((c) => c.id === convId);
            if (finalConv) {
              storage.saveConversation(userId, finalConv);
            }
            return prev;
          });
        }
      }
    },
    [
      internalModelId,
      internalEffortId,
      skillManager,
      toolManager,
      userId,
      onSendMessage,
      storage,
      updateConversationMessages,
      vfs,
    ]
  );

  // Send message and handle streaming
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const isCurrentDraft = draftConversation && draftConversation.id === activeConversationId;
      const isEphemeral = isCurrentDraft ? draftConversation.isEphemeral : activeConversation?.isEphemeral;

      let convId = activeConversationId;
      let currentConv = activeConversation;

      // Auto-title from first message
      const shouldAutoTitle =
        !currentConv ||
        currentConv.messages.length === 0 ||
        currentConv.title === 'New Chat' ||
        currentConv.title === 'Incognito Chat';

      const computedTitle = shouldAutoTitle
        ? content.slice(0, 32) + (content.length > 32 ? '...' : '')
        : currentConv?.title || 'New Chat';

      if (!convId || !currentConv) {
        convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        currentConv = {
          id: convId,
          title: computedTitle,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderId: null,
          isEphemeral,
          messages: [],
          artifacts: [],
        };
        setActiveConversationId(convId);
      }

      // Identify parent leaf message to connect tree
      const parentLeafId =
        currentConv.currentLeafId ||
        (activeBranchMessages.length > 0
          ? activeBranchMessages[activeBranchMessages.length - 1].id
          : currentConv.messages.length > 0
          ? currentConv.messages[currentConv.messages.length - 1].id
          : null);

      const userIdMsg = `msg_u_${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userIdMsg,
        role: 'user',
        content,
        createdAt: Date.now(),
        parentId: parentLeafId,
        children: [],
      };

      const assistantMessageId = `msg_a_${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        parentId: userIdMsg,
        children: [],
        toolCalls: [],
        artifacts: [],
        executionBlocks: [],
      };
      userMessage.children = [assistantMessageId];

      const updatedMessages = currentConv.messages.map((m) => {
        if (parentLeafId && m.id === parentLeafId) {
          return {
            ...m,
            children: [...(m.children || []).filter((id) => id !== userIdMsg), userIdMsg],
          };
        }
        return m;
      });
      updatedMessages.push(userMessage, assistantMessage);

      const committedConv: Conversation = {
        ...currentConv,
        id: convId,
        title: computedTitle,
        messages: updatedMessages,
        currentLeafId: assistantMessageId,
        updatedAt: Date.now(),
      };

      if (isEphemeral) {
        setDraftConversation(committedConv);
      } else {
        setDraftConversation(null);
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === convId);
          if (exists) {
            return prev.map((c) => (c.id === convId ? committedConv : c));
          }
          return [committedConv, ...prev];
        });
        await storage.saveConversation(userId, committedConv);
      }

      const messagesForPrompt = [...activeBranchMessages, userMessage];
      executeStream(convId, isEphemeral, assistantMessageId, messagesForPrompt, content);
    },
    [
      isStreaming,
      draftConversation,
      activeConversationId,
      activeConversation,
      activeBranchMessages,
      userId,
      storage,
      executeStream,
    ]
  );

  // Edit user message and branch conversation (OpenWebUI style)
  const handleEditUserMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeConversation || !newContent.trim() || isStreaming) return;

      const convId = activeConversation.id;
      const isEphemeral = activeConversation.isEphemeral;
      const originalMsg = activeConversation.messages.find((m) => m.id === messageId);
      if (!originalMsg) return;

      const parentId = originalMsg.parentId ?? null;
      const newUserId = `msg_u_${Date.now()}`;
      const newUserMsg: ChatMessage = {
        id: newUserId,
        role: 'user',
        content: newContent,
        createdAt: Date.now(),
        parentId,
        children: [],
      };

      const newAsstId = `msg_a_${Date.now()}`;
      const newAsstMsg: ChatMessage = {
        id: newAsstId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        parentId: newUserId,
        children: [],
        toolCalls: [],
        artifacts: [],
        executionBlocks: [],
      };
      newUserMsg.children = [newAsstId];

      const updatedMessages = activeConversation.messages.map((m) => {
        if (parentId && m.id === parentId) {
          return {
            ...m,
            children: [...(m.children || []).filter((id) => id !== newUserId), newUserId],
          };
        }
        return m;
      });
      updatedMessages.push(newUserMsg, newAsstMsg);

      const updatedConv: Conversation = {
        ...activeConversation,
        messages: updatedMessages,
        currentLeafId: newAsstId,
        updatedAt: Date.now(),
      };

      if (isEphemeral) {
        setDraftConversation(updatedConv);
      } else {
        setConversations((prev) => prev.map((c) => (c.id === convId ? updatedConv : c)));
        await storage.saveConversation(userId, updatedConv);
      }

      const branchUpToUser = getActiveBranch(updatedMessages, newUserId);
      executeStream(convId, isEphemeral, newAsstId, branchUpToUser, newContent);
    },
    [activeConversation, isStreaming, userId, storage, executeStream]
  );

  // Regenerate assistant message and branch conversation (OpenWebUI style)
  const handleRegenerateAssistantMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversation || isStreaming) return;

      const convId = activeConversation.id;
      const isEphemeral = activeConversation.isEphemeral;
      const targetMsg = activeConversation.messages.find((m) => m.id === messageId);
      if (!targetMsg) return;

      let userPromptMsg = targetMsg.parentId
        ? activeConversation.messages.find((m) => m.id === targetMsg.parentId)
        : undefined;

      // Fallback: search preceding user message in active branch
      if (!userPromptMsg) {
        const idx = activeBranchMessages.findIndex((m) => m.id === messageId);
        if (idx > 0 && activeBranchMessages[idx - 1].role === 'user') {
          userPromptMsg = activeBranchMessages[idx - 1];
        }
      }
      if (!userPromptMsg) return;

      const newAsstId = `msg_a_${Date.now()}`;
      const newAsstMsg: ChatMessage = {
        id: newAsstId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        parentId: userPromptMsg.id,
        children: [],
        toolCalls: [],
        artifacts: [],
        executionBlocks: [],
      };

      const updatedMessages = activeConversation.messages.map((m) => {
        if (m.id === userPromptMsg.id) {
          return {
            ...m,
            children: [...(m.children || []).filter((id) => id !== newAsstId), newAsstId],
          };
        }
        return m;
      });
      updatedMessages.push(newAsstMsg);

      const updatedConv: Conversation = {
        ...activeConversation,
        messages: updatedMessages,
        currentLeafId: newAsstId,
        updatedAt: Date.now(),
      };

      if (isEphemeral) {
        setDraftConversation(updatedConv);
      } else {
        setConversations((prev) => prev.map((c) => (c.id === convId ? updatedConv : c)));
        await storage.saveConversation(userId, updatedConv);
      }

      const branchUpToPrompt = getActiveBranch(updatedMessages, userPromptMsg.id);
      executeStream(convId, isEphemeral, newAsstId, branchUpToPrompt, userPromptMsg.content);
    },
    [activeConversation, isStreaming, activeBranchMessages, userId, storage, executeStream]
  );

  // Switch sibling message branch (OpenWebUI style)
  const handleSwitchSibling = useCallback(
    async (siblingId: string) => {
      if (!activeConversation) return;

      const targetLeafId = findDeepestLeafId(activeConversation.messages, siblingId);

      const updatedConv: Conversation = {
        ...activeConversation,
        currentLeafId: targetLeafId,
        updatedAt: Date.now(),
      };

      if (activeConversation.isEphemeral) {
        setDraftConversation(updatedConv);
      } else {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversation.id ? updatedConv : c))
        );
        await storage.saveConversation(userId, updatedConv);
      }
    },
    [activeConversation, userId, storage]
  );

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const handleOpenArtifact = useCallback((artifactId: string) => {
    setActiveArtifactId(artifactId);
    setRightDrawerOpen(true);
  }, []);

  // Compute total artifact count in active chat
  const activeArtifacts = activeConversation?.artifacts || [];

  return (
    <RendererProvider renderers={renderers}>
      <div
        className={`ai-chat-suite-root ${theme === 'dark' ? 'dark' : ''} flex h-full w-full overflow-hidden relative bg-white dark:bg-[#141415] text-slate-900 dark:text-slate-100 ${className}`}
      >
        {/* Left History & Folders Drawer */}
        <LeftSidebar
          isOpen={leftDrawerOpen}
          onClose={() => setLeftDrawerOpen(false)}
          conversations={conversations}
          activeConversationId={activeConversationId || undefined}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          onRenameConversation={handleRenameConversation}
          onMoveConversationToFolder={handleMoveConversationToFolder}
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          allowEphemeralChats={allowEphemeralChats}
        />

        {/* Central Chat Workspace */}
        <main className="flex-1 flex flex-col h-full min-w-0 relative">
          {/* Header */}
          <Header
            conversation={activeConversation}
            leftDrawerOpen={leftDrawerOpen}
            rightDrawerOpen={rightDrawerOpen}
            onToggleLeftDrawer={() => setLeftDrawerOpen(!leftDrawerOpen)}
            onToggleRightDrawer={() => setRightDrawerOpen(!rightDrawerOpen)}
            artifactCount={activeArtifacts.length}
            skillsCount={skills.length}
            onOpenSkillsModal={() => setSkillsModalOpen(true)}
          />

          {/* Messages Feed */}
          <MessageList
            messages={activeBranchMessages}
            allMessages={activeConversation?.messages || []}
            userDisplayName={userDisplayName}
            userAvatarUrl={userAvatarUrl}
            onOpenArtifact={handleOpenArtifact}
            onQuickPrompt={handleSendMessage}
            isEphemeral={activeConversation?.isEphemeral}
            skills={skillSummaries}
            allowRegeneration={allowRegeneration}
            allowEditingUserMessages={allowEditingUserMessages}
            onSwitchSibling={handleSwitchSibling}
            onEditUserMessage={handleEditUserMessage}
            onRegenerateAssistantMessage={handleRegenerateAssistantMessage}
          />

          {/* Input Bar */}
          <ChatInput
            onSendMessage={handleSendMessage}
            onStopStreaming={handleStopStreaming}
            isStreaming={isStreaming}
            skills={skillSummaries}
            models={models}
            selectedModelId={internalModelId}
            onSelectModel={handleSelectModel}
            selectedEffortId={internalEffortId}
            onSelectEffort={handleSelectEffort}
            onAddAttachment={onAddAttachment}
          />
        </main>

        {/* Right Conversation Artifacts Drawer */}
        <RightSidebar
          isOpen={rightDrawerOpen}
          onClose={() => setRightDrawerOpen(false)}
          artifacts={activeArtifacts}
          activeArtifactId={activeArtifactId}
          onSelectArtifact={(id) => setActiveArtifactId(id)}
        />

        {/* Skills Modal */}
        <SkillsModal
          isOpen={skillsModalOpen}
          onClose={() => setSkillsModalOpen(false)}
          skills={skills}
        />
      </div>
    </RendererProvider>
  );
};
