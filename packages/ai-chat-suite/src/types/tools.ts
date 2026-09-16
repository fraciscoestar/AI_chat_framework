export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolParameterProperty;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameters;
  isClientSide?: boolean; // If true, executes in browser (e.g. Pyodide or VFS)
}

export interface ToolExecutionRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
  userId?: string;
  conversationId?: string;
}

export interface ToolExecutionResult {
  id: string;
  name: string;
  result?: unknown;
  error?: string;
  isError?: boolean;
  output?: string;
}

export type ToolExecutor = (request: ToolExecutionRequest) => Promise<ToolExecutionResult>;
