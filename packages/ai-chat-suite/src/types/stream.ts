import { VirtualArtifact } from './workspace';

export type ChatStreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'thinking-delta'; delta: string }
  | { type: 'commentary-delta'; delta: string }
  | { type: 'tool-call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool-result'; id: string; result: unknown; isError?: boolean }
  | { type: 'artifact-create'; artifact: VirtualArtifact }
  | { type: 'artifact-update'; artifactId: string; delta?: string; content?: string }
  | { type: 'skill-invoked'; skillId: string; skillName?: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

export type StreamHandler = (payload: import('./chat').ChatPayload) => 
  AsyncIterable<ChatStreamEvent> | Promise<AsyncIterable<ChatStreamEvent>>;
