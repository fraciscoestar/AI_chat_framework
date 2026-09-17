import { SkillSummary } from './skills';
import { ToolDefinition } from './tools';
import { VirtualArtifact } from './workspace';
export type { VirtualArtifact };

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status?: 'pending' | 'running' | 'completed' | 'error';
  result?: unknown;
  error?: string;
}

export type ExecutionStepKind = 'read' | 'edit' | 'command' | 'note' | 'present' | 'tool';

export interface ExecutionStep {
  id: string;
  kind: ExecutionStepKind;
  title: string;
  filename?: string;
  diff?: { added: number; removed: number };
  status?: 'pending' | 'running' | 'completed' | 'error';
  toolCallId?: string;
  output?: string;
  timestamp?: number;
}

export interface ExecutionGroup {
  id: string;
  summary: string;
  subSummary?: string;
  steps: ExecutionStep[];
  isCompleted?: boolean;
}

export type ExecutionBlock =
  | { type: 'commentary'; id: string; content: string }
  | { type: 'tool-group'; id: string; group: ExecutionGroup }
  | { type: 'response-text'; id: string; content: string }
  | { type: 'artifact-card'; id: string; artifact: VirtualArtifact };

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  createdAt: number;
  parentId?: string | null;
  children?: string[];
  toolCalls?: ToolCall[];
  artifacts?: VirtualArtifact[];
  executionBlocks?: ExecutionBlock[];
  skillsUsed?: string[];
  error?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  color?: string;
  icon?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  folderId?: string | null;
  isEphemeral?: boolean;
  messages: ChatMessage[];
  currentLeafId?: string; // Pointer to current active branch leaf
  artifacts?: VirtualArtifact[];
  pinned?: boolean;
}

export interface EffortOption {
  id: string;
  label: string;
  description?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  effortLevels?: EffortOption[];
  isSecondary?: boolean;
}

export interface ChatPayload {
  conversationId: string;
  messages: ChatMessage[];
  currentPrompt: string;
  skills: SkillSummary[];
  tools?: ToolDefinition[];
  files?: Array<{ path: string; content: string }>;
  activeWorkspaceId?: string;
  isEphemeral?: boolean;
  model?: string;
  effort?: string;
  streamThinking?: boolean;
}

/**
 * Traverses backwards from current leaf node to root to compute the active linear branch of messages.
 */
export function getActiveBranch(messages: ChatMessage[], currentLeafId?: string): ChatMessage[] {
  if (!messages || messages.length === 0) return [];

  const messageMap = new Map<string, ChatMessage>();
  let hasTreePointers = false;
  for (const msg of messages) {
    messageMap.set(msg.id, msg);
    if (msg.parentId || (msg.children && msg.children.length > 0)) {
      hasTreePointers = true;
    }
  }

  // If no message in the conversation has parentId/children, it's a legacy flat array
  if (!hasTreePointers && !currentLeafId) {
    return messages;
  }

  let leaf = currentLeafId ? messageMap.get(currentLeafId) : undefined;
  if (!leaf) {
    leaf = messages[messages.length - 1];
  }

  if (!leaf) {
    return messages;
  }

  // If leaf still has no parentId and is at index > 0 without tree pointers
  if (!leaf.parentId && !hasTreePointers) {
    return messages;
  }

  const branch: ChatMessage[] = [];
  let curr: ChatMessage | undefined = leaf;

  const visited = new Set<string>();
  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    branch.unshift(curr);
    if (!curr.parentId) break;
    curr = messageMap.get(curr.parentId);
  }

  return branch;
}

/**
 * Finds all sibling message IDs for a given message ID and the current message's 0-based index.
 */
export function getMessageSiblings(
  messages: ChatMessage[],
  messageId: string
): { siblings: string[]; currentIndex: number } {
  const target = messages.find((m) => m.id === messageId);
  if (!target) return { siblings: [messageId], currentIndex: 0 };

  // If parentId is undefined (legacy non-tree messages), no siblings
  if (target.parentId === undefined) {
    return { siblings: [messageId], currentIndex: 0 };
  }

  const parentId = target.parentId;
  // Siblings share the exact same parentId and same role
  const siblings = messages
    .filter((m) => m.parentId === parentId && m.role === target.role)
    .map((m) => m.id);

  const currentIndex = siblings.indexOf(messageId);

  return {
    siblings: siblings.length > 0 ? siblings : [messageId],
    currentIndex: currentIndex >= 0 ? currentIndex : 0,
  };
}

/**
 * Follows the child path downwards from a given node to find the deepest active leaf.
 */
export function findDeepestLeafId(messages: ChatMessage[], startId: string): string {
  const map = new Map<string, ChatMessage>();
  for (const m of messages) map.set(m.id, m);

  let curr = map.get(startId);
  if (!curr) return startId;

  const visited = new Set<string>();
  while (curr && curr.children && curr.children.length > 0) {
    visited.add(curr.id);
    const nextId = curr.children[curr.children.length - 1];
    if (visited.has(nextId)) break;
    const nextNode = map.get(nextId);
    if (!nextNode) break;
    curr = nextNode;
  }
  return curr.id;
}
