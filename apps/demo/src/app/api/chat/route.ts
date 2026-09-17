import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SkillItem {
  id: string;
  name: string;
  description: string;
  content?: string;
}

interface ToolItem {
  name: string;
  description: string;
}

function buildSystemPrompt(
  skills: SkillItem[] = [],
  tools: ToolItem[] = [],
  streamThinking: boolean = false
): string {
  const lines: string[] = [
    'You are an expert autonomous AI software architect and coding assistant powered by the AI Chat Framework.',
    'You operate with an advanced agentic workflow with direct access to an interactive sandboxed Virtual File System (VFS), domain skills, and code execution tools.',
  ];

  if (streamThinking) {
    lines.push(
      '',
      '## REAL-TIME THINKING PROCESS (USER OPTED-IN)',
      'The user has explicitly opted in to watch your reasoning live in real time.',
      'Before emitting any tool call or response text, you MUST output your internal step-by-step reasoning inside `<think>...</think>` tags.',
      'CRITICAL RULES FOR REASONING:',
      '1. NEVER output conversational filler or planning statements (e.g. "I will start by...", "Both skills loaded...") in the main chat text before calling tools.',
      '2. All pre-tool planning, evaluations, and decision-making MUST be wrapped inside `<think>...</think>` tags.',
      '3. In your thoughts, cover:',
      '   - Understanding user intent, core requirements, and non-functional requirements.',
      '   - Evaluating skills and tools to apply.',
      '   - Architecture structure, component breakdown, and file naming.',
      '   - Tool call plan and artifact presentation strategy.'
    );
  }

  if (skills && skills.length > 0) {
    lines.push(
      '',
      '## Available Skills Catalog',
      'You know all available skills in the catalog upfront. You can AUTONOMOUSLY DECIDE to read any skill using `read_skill(skillId)` when relevant:',
      '<available_skills>'
    );
    for (const skill of skills) {
      lines.push(`  <skill id="${skill.id}">`);
      lines.push(`    <name>${skill.name}</name>`);
      lines.push(`    <description>${skill.description}</description>`);
      lines.push('  </skill>');
    }
    lines.push('</available_skills>');
  }

  lines.push(
    '',
    '## Available Tools',
    'You have the following workspace tools available via function/tool calling:',
    '- `read_skill`: Read full instructions for a skill. Parameters: `{"skillId": "<id>"}`.',
    '- `workspace_write_file`: Create or update a file in the workspace sandbox. Parameters: `{"path": "<filepath>", "content": "<content>"}`.',
    '- `workspace_present_file`: Present a file as an interactive artifact in the chat feed and side drawer. Parameters: `{"path": "<filepath>", "title": "<title>"}`.',
    '- `workspace_read_file`: Read a workspace file. Parameters: `{"path": "<filepath>"}`.',
    '- `workspace_edit_file`: Targeted string replacement in a file. Parameters: `{"path": "<filepath>", "target_string": "...", "replacement_string": "..."}`.',
    '- `workspace_list_files`: List files in the workspace. Parameters: `{"directory": "/"}`.',
    '- `python_eval`: Execute Python code in the browser sandbox. Parameters: `{"code": "..."}`.',
    '- `agent_note`: Record an intermediate reasoning note or checkpoint in the execution timeline. (NOTE: `agent_note` DOES NOT create files or present artifacts).'
  );

  lines.push(
    '',
    '## WORKSPACE & ARTIFACTS ARCHITECTURE (CLAUDE-STYLE AGENTIC EXECUTION)',
    '1. CRITICAL: NEVER dump long multi-section documents, entire architecture specifications, or complete codebases directly into the chat response text!',
    '2. When the user requests an architecture specification, document, report, or code:',
    '   - Step 1: Reason step-by-step about architecture, requirements, and file layout (inside `<think>...</think>`).',
    '   - Step 2: Call `read_skill` if an applicable skill exists in `<available_skills>`.',
    '   - Step 3: Call `workspace_write_file` to write the complete, production-ready document to the workspace sandbox (e.g. `/docs/...` or `/src/...`). DO NOT truncate with ellipses ("...").',
    '   - Step 4: Call `workspace_present_file` to surface it as an interactive artifact in the user side drawer.',
    '   - Step 5: In your chat response, output ONLY a concise executive summary, highlights, and an interactive Mermaid flowchart (`flowchart TB` or `graph TD`). Keep the chat response focused and readable.',
    '3. Execute your tool calls immediately right now in this turn. Do not merely announce plans without calling tools.',
    '4. When the user requests to edit, modify, update, or change an existing file or artifact (e.g. change colors, add steps, update code):',
    '   - Step 1: Call `workspace_read_file` to read the existing file content from the workspace sandbox.',
    '   - Step 2: Use `workspace_edit_file` for targeted string replacements, or `workspace_write_file` to update the file.',
    '   - Step 3: Call `workspace_present_file` to ensure the updated artifact is rendered in the user side drawer.',
    '   - Step 4: Confirm your changes clearly and concisely in chat (and provide an updated Mermaid diagram if relevant).',
    '',
    '## Example of Correct Response Pattern',
    'User: Write a comprehensive system architecture document with a Mermaid flowchart showing a microservices setup.',
    'Assistant:',
    '<think>',
    'The user requested a microservices architecture. I will consult the architecture-diagrammer skill, write the complete specification file to /docs/microservices_architecture.md, present it in the artifact drawer, and write an executive summary with a Mermaid diagram in chat.',
    '</think>',
    '(Assistant invokes tools: read_skill -> workspace_write_file -> workspace_present_file)',
    'I have created the comprehensive architecture specification in `/docs/microservices_architecture.md` and presented it in your artifacts drawer on the right.',
    '',
    '### System Overview & Microservices Topology',
    '```mermaid',
    'graph TD',
    '  Client[Web / Mobile Client] --> Gateway[API Gateway]',
    '  Gateway --> Auth[Auth Service]',
    '  Gateway --> Orders[Order Service]',
    '  Gateway --> Users[User Service]',
    '  Orders --> Broker[(Kafka Message Broker)]',
    '  Orders --> DB[(PostgreSQL Database)]',
    '```'
  );

  return lines.join('\n');
}

class StreamTagProcessor {
  private buffer = '';
  private state: 'text' | 'think' | 'tool_call' = 'text';
  private toolCallBuffer = '';

  private readonly THINK_OPEN_TAGS = ['<think>', '<thought>', '<reasoning>', '<thinking>'];
  private readonly THINK_CLOSE_TAGS = ['</think>', '</thought>', '</reasoning>', '</thinking>'];
  private readonly TOOL_OPEN_TAGS = ['<tool_call>', '```tool_call'];
  private readonly TOOL_CLOSE_TAGS = ['</tool_call>', '```'];

  constructor(
    private onText: (text: string) => void,
    private onThinking: (thinking: string) => void,
    private onToolCall: (toolCallJson: string) => void
  ) {}

  process(chunk: string) {
    this.buffer += chunk;
    this.flush(false);
  }

  finish() {
    this.flush(true);
  }

  private flush(isEnd: boolean) {
    while (this.buffer.length > 0) {
      const lowerBuf = this.buffer.toLowerCase();

      if (this.state === 'text') {
        let earliestIdx = -1;
        let matchedTagLen = 0;
        let matchedType: 'think' | 'tool' = 'think';

        for (const tag of this.THINK_OPEN_TAGS) {
          const idx = lowerBuf.indexOf(tag.toLowerCase());
          if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
            earliestIdx = idx;
            matchedTagLen = tag.length;
            matchedType = 'think';
          }
        }

        for (const tag of this.TOOL_OPEN_TAGS) {
          const idx = lowerBuf.indexOf(tag.toLowerCase());
          if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
            earliestIdx = idx;
            matchedTagLen = tag.length;
            matchedType = 'tool';
          }
        }

        if (earliestIdx !== -1) {
          if (earliestIdx > 0) {
            this.onText(this.buffer.slice(0, earliestIdx));
          }
          this.buffer = this.buffer.slice(earliestIdx + matchedTagLen);
          if (matchedType === 'think') {
            this.state = 'think';
          } else {
            this.state = 'tool_call';
            this.toolCallBuffer = '';
          }
        } else {
          if (!isEnd) {
            let maxKeep = 0;
            for (const p of [...this.THINK_OPEN_TAGS, ...this.TOOL_OPEN_TAGS]) {
              const lowerP = p.toLowerCase();
              for (let len = 1; len < lowerP.length; len++) {
                if (lowerBuf.endsWith(lowerP.slice(0, len))) {
                  maxKeep = Math.max(maxKeep, len);
                }
              }
            }
            if (maxKeep > 0) {
              const safeText = this.buffer.slice(0, -maxKeep);
              if (safeText) this.onText(safeText);
              this.buffer = this.buffer.slice(-maxKeep);
              return;
            }
          }
          this.onText(this.buffer);
          this.buffer = '';
        }
      } else if (this.state === 'think') {
        let earliestEndIdx = -1;
        let matchedEndTagLen = 0;

        for (const tag of this.THINK_CLOSE_TAGS) {
          const idx = lowerBuf.indexOf(tag.toLowerCase());
          if (idx !== -1 && (earliestEndIdx === -1 || idx < earliestEndIdx)) {
            earliestEndIdx = idx;
            matchedEndTagLen = tag.length;
          }
        }

        if (earliestEndIdx !== -1) {
          if (earliestEndIdx > 0) {
            this.onThinking(this.buffer.slice(0, earliestEndIdx));
          }
          this.buffer = this.buffer.slice(earliestEndIdx + matchedEndTagLen);
          this.state = 'text';
        } else {
          if (!isEnd) {
            let keep = 0;
            for (const endTag of this.THINK_CLOSE_TAGS) {
              const lowerEnd = endTag.toLowerCase();
              for (let len = 1; len < lowerEnd.length; len++) {
                if (lowerBuf.endsWith(lowerEnd.slice(0, len))) {
                  keep = Math.max(keep, len);
                }
              }
            }
            if (keep > 0) {
              const safeThinking = this.buffer.slice(0, -keep);
              if (safeThinking) this.onThinking(safeThinking);
              this.buffer = this.buffer.slice(-keep);
              return;
            }
          }
          this.onThinking(this.buffer);
          this.buffer = '';
        }
      } else if (this.state === 'tool_call') {
        let earliestEndIdx = -1;
        let matchedEndTagLen = 0;

        for (const tag of this.TOOL_CLOSE_TAGS) {
          const idx = lowerBuf.indexOf(tag.toLowerCase());
          if (idx !== -1 && (earliestEndIdx === -1 || idx < earliestEndIdx)) {
            earliestEndIdx = idx;
            matchedEndTagLen = tag.length;
          }
        }

        if (earliestEndIdx !== -1) {
          this.toolCallBuffer += this.buffer.slice(0, earliestEndIdx);
          this.buffer = this.buffer.slice(earliestEndIdx + matchedEndTagLen);
          this.onToolCall(this.toolCallBuffer.trim());
          this.toolCallBuffer = '';
          this.state = 'text';
        } else {
          if (isEnd) {
            this.toolCallBuffer += this.buffer;
            this.onToolCall(this.toolCallBuffer.trim());
            this.toolCallBuffer = '';
            this.buffer = '';
          } else {
            let keep = 0;
            for (const tag of this.TOOL_CLOSE_TAGS) {
              const lowerTag = tag.toLowerCase();
              for (let len = 1; len < lowerTag.length; len++) {
                if (lowerBuf.endsWith(lowerTag.slice(0, len))) {
                  keep = Math.max(keep, len);
                }
              }
            }
            if (keep > 0) {
              this.toolCallBuffer += this.buffer.slice(0, -keep);
              this.buffer = this.buffer.slice(-keep);
              return;
            } else {
              this.toolCallBuffer += this.buffer;
              this.buffer = '';
            }
          }
        }
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      currentPrompt = '',
      apiKey = '',
      endpointUrl = '',
      model = '',
      effort = '',
      skills = [],
      tools = [],
      files = [],
      streamThinking = false,
    } = body;

    // Server-side virtual workspace files map (synced from client VFS and message artifacts)
    const virtualFilesMap = new Map<string, string>();

    const registerFile = (filePath: string, content: string) => {
      if (!filePath || typeof content !== 'string') return;
      const normalized = filePath.replace(/\\/g, '/').trim();
      const withSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
      const withoutSlash = withSlash.slice(1);
      const basename = withoutSlash.split('/').pop() || withoutSlash;

      virtualFilesMap.set(withSlash, content);
      virtualFilesMap.set(withoutSlash, content);
      virtualFilesMap.set(basename, content);
    };

    if (Array.isArray(files)) {
      for (const f of files) {
        if (f && f.path && typeof f.content === 'string') {
          registerFile(f.path, f.content);
        }
      }
    }

    if (Array.isArray(messages)) {
      for (const m of messages) {
        if (Array.isArray(m.artifacts)) {
          for (const art of m.artifacts) {
            if (art && art.filename && typeof art.content === 'string') {
              registerFile(art.filename, art.content);
              if (art.title) registerFile(art.title + '.md', art.content);
            }
          }
        }
        if (Array.isArray(m.executionBlocks)) {
          for (const b of m.executionBlocks) {
            if (b && b.type === 'artifact-card' && b.artifact) {
              const art = b.artifact;
              if (art.filename && typeof art.content === 'string') {
                registerFile(art.filename, art.content);
                if (art.title) registerFile(art.title + '.md', art.content);
              }
            }
          }
        }
      }
    }

    const findFileContent = (reqPath: string): { path: string; content: string } | null => {
      if (!reqPath) return null;
      const cleaned = reqPath.replace(/\\/g, '/').trim();
      const withSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
      const withoutSlash = withSlash.slice(1);
      const basename = withoutSlash.split('/').pop() || withoutSlash;

      if (virtualFilesMap.has(cleaned)) return { path: cleaned, content: virtualFilesMap.get(cleaned)! };
      if (virtualFilesMap.has(withSlash)) return { path: withSlash, content: virtualFilesMap.get(withSlash)! };
      if (virtualFilesMap.has(withoutSlash)) return { path: withoutSlash, content: virtualFilesMap.get(withoutSlash)! };
      if (virtualFilesMap.has(basename)) return { path: basename, content: virtualFilesMap.get(basename)! };

      const lowerBase = basename.toLowerCase();
      for (const [key, content] of virtualFilesMap.entries()) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === lowerBase ||
          lowerKey.endsWith('/' + lowerBase) ||
          lowerBase.includes(lowerKey.replace(/\.[^/.]+$/, '')) ||
          lowerKey.includes(lowerBase.replace(/\.[^/.]+$/, ''))
        ) {
          return { path: key, content };
        }
      }

      return null;
    };

    const url = endpointUrl.trim() || 'https://api.openai.com/v1/chat/completions';
    const selectedModel = model.trim() || 'gpt-4o';
    const isAnthropic = url.includes('anthropic.com');

    // Headers setup
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      if (isAnthropic) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
    }

    if (url.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = req.headers.get('origin') || 'http://localhost:3000';
      headers['X-Title'] = 'AI Chat Suite';
    }

    // Build system prompt with skills catalog and tools documentation
    const systemPrompt = buildSystemPrompt(skills, tools, Boolean(streamThinking));

    // Normalize and avoid duplicate consecutive messages
    const formattedMessages: Array<{ role: string; content: string }> = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })
    );

    // Inject system prompt into messages
    const existingSystemIdx = formattedMessages.findIndex((m) => m.role === 'system');
    if (existingSystemIdx === -1) {
      formattedMessages.unshift({ role: 'system', content: systemPrompt });
    } else {
      formattedMessages[existingSystemIdx].content = `${systemPrompt}\n\n${formattedMessages[existingSystemIdx].content}`;
    }

    // Only append currentPrompt if messages does not already end with it
    const lastMsg = formattedMessages[formattedMessages.length - 1];
    if (
      currentPrompt.trim() &&
      (!lastMsg || lastMsg.role !== 'user' || lastMsg.content.trim() !== currentPrompt.trim())
    ) {
      const contentToAppend = streamThinking
        ? `${currentPrompt}\n\n(IMPORTANT: Formulate your step-by-step reasoning inside <think>...</think> tags before calling tools or responding)`
        : currentPrompt;
      formattedMessages.push({ role: 'user', content: contentToAppend });
    } else if (streamThinking && lastMsg && lastMsg.role === 'user') {
      if (!lastMsg.content.includes('<think>')) {
        lastMsg.content = `${lastMsg.content}\n\n(IMPORTANT: Formulate your step-by-step reasoning inside <think>...</think> tags before calling tools or responding)`;
      }
    }

    // Build payload
    let anthropicModel = selectedModel;
    if (anthropicModel === 'claude-3-7-sonnet') {
      anthropicModel = 'claude-3-7-sonnet-20250219';
    } else if (anthropicModel === 'claude-3-5-sonnet') {
      anthropicModel = 'claude-3-5-sonnet-20241022';
    } else if (anthropicModel === 'claude-3-5-haiku') {
      anthropicModel = 'claude-3-5-haiku-20241022';
    } else if (!anthropicModel.includes('claude')) {
      anthropicModel = 'claude-3-5-sonnet-20241022';
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;
        const safeClose = () => {
          if (!isClosed) {
            isClosed = true;
            try {
              controller.close();
            } catch {
              // Ignore already closed
            }
          }
        };

        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data);
            } catch {
              // Controller may have closed
            }
          }
        };

        // Emit initial thinking signal so client immediately reflects thinking state
        safeEnqueue(encoder.encode(JSON.stringify({ type: 'thinking-delta', delta: '' }) + '\n'));

        try {
          const currentMessages: Array<{
            role: string;
            content: string | null;
            tool_calls?: Array<{
              id: string;
              type: 'function';
              function: { name: string; arguments: string };
            }>;
            tool_call_id?: string;
          }> = [...formattedMessages];
          const MAX_TURNS = 8;
          let turn = 0;
          let shouldContinue = true;

          // Format tools for OpenAI and Anthropic endpoints
          const formattedOpenAiTools =
            Array.isArray(tools) && tools.length > 0
              ? tools.map((t: any) => ({
                  type: 'function',
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters || { type: 'object', properties: {} },
                  },
                }))
              : undefined;

          const formattedAnthropicTools =
            Array.isArray(tools) && tools.length > 0
              ? tools.map((t: any) => ({
                  name: t.name,
                  description: t.description,
                  input_schema: t.parameters || { type: 'object', properties: {} },
                }))
              : undefined;

          while (shouldContinue && turn < MAX_TURNS && !isClosed) {
            turn++;

            const turnToolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
            let turnText = '';
            let turnRawContent = '';

            const handleParsedToolCall = (toolCallStr: string) => {
              if (!toolCallStr) return;
              try {
                const cleaned = toolCallStr
                  .replace(/^```(?:json)?\s*/i, '')
                  .replace(/\s*```$/i, '')
                  .trim();
                let parsed = JSON.parse(cleaned);
                let name = parsed.name || parsed.tool || parsed.function;
                let args = (parsed.args || parsed.parameters || parsed.arguments || {}) as Record<string, unknown>;

                // Defensively handle tool names that are stringified JSON objects
                if (typeof name === 'string' && name.trim().startsWith('{') && name.trim().endsWith('}')) {
                  try {
                    const inner = JSON.parse(name.trim());
                    if (inner.name || inner.tool || inner.function) {
                      name = inner.name || inner.tool || inner.function;
                      args = { ...(inner.args || inner.parameters || inner.arguments || {}), ...args };
                    }
                  } catch {}
                }

                if (name) {
                  const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                  turnToolCalls.push({ id: callId, name, args });
                  safeEnqueue(
                    encoder.encode(
                      JSON.stringify({
                        type: 'tool-call',
                        id: callId,
                        name,
                        args,
                      }) + '\n'
                    )
                  );

                  // If tool is read_skill, emit tool-result immediately with skill details
                  if (name === 'read_skill') {
                    const skillId = String(args.skillId || args.id || '');
                    const matchedSkill = skills.find((s: { id: string }) => s.id === skillId);
                    if (matchedSkill) {
                      safeEnqueue(
                        encoder.encode(
                          JSON.stringify({
                            type: 'tool-result',
                            id: callId,
                            result: {
                              id: matchedSkill.id,
                              name: matchedSkill.name,
                              content: matchedSkill.content,
                            },
                          }) + '\n'
                        )
                      );
                    }
                  }
                }
              } catch (err) {
                console.warn('[StreamTagProcessor] Failed to parse tool call JSON:', toolCallStr, err);
              }
            };

            const tagProcessor = new StreamTagProcessor(
              (text) => {
                turnText += text;
                safeEnqueue(encoder.encode(JSON.stringify({ type: 'text-delta', delta: text }) + '\n'));
              },
              (thinking) => {
                safeEnqueue(
                  encoder.encode(JSON.stringify({ type: 'thinking-delta', delta: thinking }) + '\n')
                );
              },
              handleParsedToolCall
            );

            // Native OpenAI tool calls accumulator
            const nativeToolCalls = new Map<number, { id: string; name: string; argsStr: string }>();

            // Build payload for this turn
            let payloadBody: string;
            if (isAnthropic) {
              const systemMessages = currentMessages
                .filter((m) => m.role === 'system')
                .map((m) => m.content)
                .join('\n\n');

              const chatMessages = currentMessages.filter(
                (m) => m.role === 'user' || m.role === 'assistant'
              );

              const anthropicPayload: Record<string, unknown> = {
                model: anthropicModel,
                max_tokens: 4096,
                stream: true,
                ...(systemMessages ? { system: systemMessages } : {}),
                messages: chatMessages,
              };
              if (formattedAnthropicTools && formattedAnthropicTools.length > 0) {
                anthropicPayload.tools = formattedAnthropicTools;
              }
              if (streamThinking && anthropicModel.includes('3-7')) {
                anthropicPayload.thinking = { type: 'enabled', budget_tokens: 2048 };
              }
              payloadBody = JSON.stringify(anthropicPayload);
            } else {
              const openAiPayload: Record<string, unknown> = {
                model: selectedModel,
                stream: true,
                messages: currentMessages,
              };
              if (formattedOpenAiTools && formattedOpenAiTools.length > 0) {
                openAiPayload.tools = formattedOpenAiTools;
                openAiPayload.tool_choice = 'auto';
              }
              if (streamThinking) {
                openAiPayload.include_reasoning = true;
                openAiPayload.reasoning_effort = effort || 'medium';
                openAiPayload.reasoning = { effort: effort || 'medium' };
              }
              payloadBody = JSON.stringify(openAiPayload);
            }

            const response = await fetch(url, {
              method: 'POST',
              headers,
              body: payloadBody,
            });

            if (!response.ok || !response.body) {
              const errText = await response.text();
              let parsedError = errText;
              try {
                const parsed = JSON.parse(errText);
                parsedError = parsed.error?.message || parsed.message || errText;
              } catch {
                // use raw text
              }
              safeEnqueue(
                encoder.encode(
                  JSON.stringify({
                    type: 'error',
                    message: `API Endpoint error (${response.status}): ${parsedError}`,
                  }) + '\n'
                )
              );
              break;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let isStreamFinished = false;

            // Clean up upstream if client aborts request
            const abortHandler = () => {
              reader.cancel().catch(() => {});
              safeClose();
            };
            req.signal.addEventListener('abort', abortHandler);

            while (!isStreamFinished) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;
                const dataStr = trimmed.replace(/^data:\s*/, '').trim();

                if (dataStr === '[DONE]') {
                  isStreamFinished = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(dataStr);

                  // Anthropic message stop event
                  if (parsed.type === 'message_stop') {
                    isStreamFinished = true;
                    break;
                  }

                  // Anthropic message stream format
                  if (parsed.type === 'content_block_delta') {
                    if (parsed.delta?.type === 'thinking_delta' && parsed.delta?.thinking) {
                      safeEnqueue(
                        encoder.encode(
                          JSON.stringify({
                            type: 'thinking-delta',
                            delta: parsed.delta.thinking,
                          }) + '\n'
                        )
                      );
                    } else if (parsed.delta?.text) {
                      turnRawContent += parsed.delta.text;
                      tagProcessor.process(parsed.delta.text);
                    }
                  } else if (parsed.choices && parsed.choices[0]?.delta) {
                    const deltaObj = parsed.choices[0].delta;

                    // Reasoning / Thinking tokens (DeepSeek, Qwen, vLLM, Gemini proxies)
                    const reasoningDelta =
                      deltaObj.reasoning_content ||
                      deltaObj.reasoning ||
                      deltaObj.thought ||
                      deltaObj.thinking;
                    if (reasoningDelta) {
                      safeEnqueue(
                        encoder.encode(
                          JSON.stringify({
                            type: 'thinking-delta',
                            delta: reasoningDelta,
                          }) + '\n'
                        )
                      );
                    }

                    // Native OpenAI tool_calls
                    if (deltaObj.tool_calls && Array.isArray(deltaObj.tool_calls)) {
                      for (const tc of deltaObj.tool_calls) {
                        const idx = tc.index ?? 0;
                        if (!nativeToolCalls.has(idx)) {
                          nativeToolCalls.set(idx, {
                            id: tc.id || `call_${Date.now()}_${idx}`,
                            name: tc.function?.name || '',
                            argsStr: tc.function?.arguments || '',
                          });
                        } else {
                          const existing = nativeToolCalls.get(idx)!;
                          if (tc.id) existing.id = tc.id;
                          if (tc.function?.name) existing.name += tc.function.name;
                          if (tc.function?.arguments) existing.argsStr += tc.function.arguments;
                        }
                      }
                    }

                    // Content text tokens
                    if (deltaObj.content) {
                      turnRawContent += deltaObj.content;
                      tagProcessor.process(deltaObj.content);
                    }
                  }
                } catch {
                  // Ignore chunk parse errors
                }
              }
            }

            // Finish tag processor buffer
            tagProcessor.finish();

            // Flush any native tool calls
            for (const tc of nativeToolCalls.values()) {
              if (tc.name) {
                try {
                  let callName = tc.name;
                  let parsedArgs = (tc.argsStr ? JSON.parse(tc.argsStr) : {}) as Record<string, unknown>;

                  // Defensively handle stringified JSON in tool name (common with Qwen/vLLM/Ollama proxies)
                  if (typeof callName === 'string' && callName.trim().startsWith('{') && callName.trim().endsWith('}')) {
                    try {
                      const inner = JSON.parse(callName.trim());
                      if (inner.name || inner.tool || inner.function) {
                        callName = inner.name || inner.tool || inner.function;
                        parsedArgs = {
                          ...(inner.args || inner.parameters || inner.arguments || {}),
                          ...parsedArgs,
                        };
                      }
                    } catch {}
                  }

                  turnToolCalls.push({ id: tc.id, name: callName, args: parsedArgs });
                  safeEnqueue(
                    encoder.encode(
                      JSON.stringify({
                        type: 'tool-call',
                        id: tc.id,
                        name: callName,
                        args: parsedArgs,
                      }) + '\n'
                    )
                  );

                  // If native tool is read_skill, emit tool-result immediately with skill details
                  if (callName === 'read_skill') {
                    const skillId = String(parsedArgs.skillId || parsedArgs.id || '');
                    const matchedSkill = skills.find((s: { id: string }) => s.id === skillId);
                    if (matchedSkill) {
                      safeEnqueue(
                        encoder.encode(
                          JSON.stringify({
                            type: 'tool-result',
                            id: tc.id,
                            result: {
                              id: matchedSkill.id,
                              name: matchedSkill.name,
                              content: matchedSkill.content,
                            },
                          }) + '\n'
                        )
                      );
                    }
                  } else if (callName === 'workspace_read_file') {
                    const reqPath = String(parsedArgs.path || parsedArgs.file || parsedArgs.filename || '');
                    const found = findFileContent(reqPath);
                    if (found) {
                      safeEnqueue(
                        encoder.encode(
                          JSON.stringify({
                            type: 'tool-result',
                            id: tc.id,
                            result: {
                              path: found.path,
                              content: found.content,
                            },
                          }) + '\n'
                        )
                      );
                    }
                  }
                } catch {
                  // Ignore invalid JSON in native tool call
                }
              }
            }

            reader.cancel().catch(() => {});
            req.signal.removeEventListener('abort', abortHandler);

            // Continuation decision
            const hasToolCalls = turnToolCalls.length > 0;
            const hasWorkspaceFileOps = turnToolCalls.some(
              (t) => t.name === 'workspace_write_file' || t.name === 'workspace_present_file'
            );
            const lowerText = turnText.toLowerCase();
            const isStallingPhrase =
              !hasToolCalls &&
              turnText.length < 300 &&
              (lowerText.includes("i'll start by") ||
                lowerText.includes("i will start by") ||
                lowerText.includes("let me start") ||
                lowerText.includes("i will consult") ||
                lowerText.includes("i'll consult") ||
                lowerText.includes("first, i will") ||
                lowerText.includes("first, i'll") ||
                lowerText.includes("i'll begin by"));

            if (hasToolCalls) {
              if (nativeToolCalls.size > 0) {
                // OpenAI function calling standard protocol:
                // 1. Assistant message with tool_calls
                currentMessages.push({
                  role: 'assistant',
                  content: turnText || null,
                  tool_calls: turnToolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.name,
                      arguments: JSON.stringify(tc.args),
                    },
                  })),
                });

                // 2. Individual tool response message for each tool call
                for (const tc of turnToolCalls) {
                  let toolResultContent = '';
                  if (tc.name === 'read_skill') {
                    const skillId = String(tc.args.skillId || tc.args.id || '');
                    const matchedSkill = skills.find((s: { id: string }) => s.id === skillId);
                    if (matchedSkill) {
                      toolResultContent = JSON.stringify({
                        status: 'success',
                        id: matchedSkill.id,
                        name: matchedSkill.name,
                        instructions: matchedSkill.content,
                        instruction_hint: 'Formulate reasoning inside <think>...</think>, then call workspace_write_file to create the file.',
                      });
                    } else {
                      toolResultContent = JSON.stringify({
                        status: 'error',
                        message: `Skill '${skillId}' not found. Available skills: ${skills.map((s: { id: string }) => s.id).join(', ')}`,
                      });
                    }
                  } else if (tc.name === 'workspace_read_file') {
                    const reqPath = String(tc.args.path || tc.args.file || tc.args.filename || '');
                    const found = findFileContent(reqPath);
                    if (found) {
                      toolResultContent = JSON.stringify({
                        status: 'success',
                        path: found.path,
                        content: found.content,
                        message: `File '${found.path}' (${found.content.length} bytes) read successfully from workspace sandbox.`,
                      });
                    } else {
                      const available = Array.from(
                        new Set(Array.from(virtualFilesMap.keys()).map((k) => k.replace(/^\//, '')))
                      );
                      toolResultContent = JSON.stringify({
                        status: 'error',
                        message: `File '${reqPath}' not found in workspace sandbox. Available files: ${
                          available.length > 0 ? available.join(', ') : '(empty workspace)'
                        }`,
                      });
                    }
                  } else if (tc.name === 'workspace_edit_file') {
                    const reqPath = String(tc.args.path || tc.args.file || tc.args.filename || '');
                    const found = findFileContent(reqPath);
                    if (found) {
                      let updated = found.content;
                      const target = tc.args.target_string !== undefined ? String(tc.args.target_string) : undefined;
                      const replacement = tc.args.replacement_string !== undefined ? String(tc.args.replacement_string) : undefined;
                      if (target !== undefined && replacement !== undefined) {
                        if (updated.includes(target)) {
                          updated = updated.replace(target, replacement);
                          registerFile(found.path, updated);
                          toolResultContent = JSON.stringify({
                            status: 'success',
                            path: found.path,
                            message: `File '${found.path}' updated successfully with target replacement. You can now present the updated file or summarize changes.`,
                          });
                        } else {
                          toolResultContent = JSON.stringify({
                            status: 'error',
                            message: `Target string was not found in '${found.path}'. Ensure target string matches existing text exactly.`,
                          });
                        }
                      } else {
                        toolResultContent = JSON.stringify({
                          status: 'success',
                          path: found.path,
                          message: `File '${found.path}' edited successfully.`,
                        });
                      }
                    } else {
                      toolResultContent = JSON.stringify({
                        status: 'error',
                        message: `File '${reqPath}' not found in workspace to edit.`,
                      });
                    }
                  } else if (tc.name === 'workspace_list_files') {
                    const uniqueFiles = Array.from(
                      new Set(Array.from(virtualFilesMap.keys()).filter((k) => k.startsWith('/')))
                    ).map((p) => ({
                      path: p,
                      size: virtualFilesMap.get(p)?.length || 0,
                    }));
                    toolResultContent = JSON.stringify({
                      status: 'success',
                      files: uniqueFiles,
                      message: `Found ${uniqueFiles.length} file(s) in workspace.`,
                    });
                  } else if (tc.name === 'workspace_write_file') {
                    const p = String(tc.args.path || '');
                    const c = String(tc.args.content || '');
                    if (p) registerFile(p, c);
                    toolResultContent = JSON.stringify({
                      status: 'success',
                      path: tc.args.path,
                      message: `File ${tc.args.path} successfully written to workspace sandbox. You MUST now call workspace_present_file to display it as an artifact in the user drawer.`,
                      instruction_hint: 'Call workspace_present_file immediately to present the created file.',
                    });
                  } else if (tc.name === 'workspace_present_file') {
                    toolResultContent = JSON.stringify({
                      status: 'success',
                      path: tc.args.path,
                      title: tc.args.title,
                      message: `Artifact ${tc.args.title} presented in side drawer. You MUST now provide your concise executive summary and interactive Mermaid diagram (flowchart TB or graph TD) directly in your chat response.`,
                      instruction_hint: 'Provide executive summary and Mermaid diagram in chat response.',
                    });
                  } else {
                    toolResultContent = JSON.stringify({ status: 'success', tool: tc.name });
                  }

                  currentMessages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: toolResultContent,
                  });
                }
              } else {
                // XML format tool calls fallback
                const assistantContent =
                  turnRawContent ||
                  turnText ||
                  turnToolCalls
                    .map((tc) => `<tool_call>\n${JSON.stringify({ name: tc.name, args: tc.args })}\n</tool_call>`)
                    .join('\n');

                currentMessages.push({
                  role: 'assistant',
                  content: assistantContent,
                });

                let toolFeedback = '';
                for (const tc of turnToolCalls) {
                  if (tc.name === 'read_skill') {
                    const skillId = String(tc.args.skillId || tc.args.id || '');
                    const matchedSkill = skills.find((s: { id: string }) => s.id === skillId);
                    if (matchedSkill) {
                      toolFeedback += `[Skill Loaded: "${matchedSkill.name}"]\n${matchedSkill.content}\n\n`;
                    }
                  } else if (tc.name === 'workspace_read_file') {
                    const reqPath = String(tc.args.path || tc.args.file || tc.args.filename || '');
                    const found = findFileContent(reqPath);
                    if (found) {
                      toolFeedback += `[Content of file "${found.path}"]:\n${found.content}\n\n`;
                    } else {
                      const available = Array.from(
                        new Set(Array.from(virtualFilesMap.keys()).map((k) => k.replace(/^\//, '')))
                      );
                      toolFeedback += `[Error: File "${reqPath}" not found. Available files: ${available.join(', ') || 'none'}]\n\n`;
                    }
                  } else if (tc.name === 'workspace_edit_file') {
                    const reqPath = String(tc.args.path || tc.args.file || tc.args.filename || '');
                    const found = findFileContent(reqPath);
                    if (found) {
                      let updated = found.content;
                      const target = tc.args.target_string !== undefined ? String(tc.args.target_string) : undefined;
                      const replacement = tc.args.replacement_string !== undefined ? String(tc.args.replacement_string) : undefined;
                      if (target !== undefined && replacement !== undefined && updated.includes(target)) {
                        updated = updated.replace(target, replacement);
                        registerFile(found.path, updated);
                        toolFeedback += `[File "${found.path}" updated successfully.]\n`;
                      } else {
                        toolFeedback += `[File "${found.path}" edit completed.]\n`;
                      }
                    } else {
                      toolFeedback += `[Error: File "${reqPath}" not found in workspace to edit.]\n`;
                    }
                  } else if (tc.name === 'workspace_list_files') {
                    const uniqueFiles = Array.from(
                      new Set(Array.from(virtualFilesMap.keys()).filter((k) => k.startsWith('/')))
                    ).map((p) => `- ${p} (${virtualFilesMap.get(p)?.length || 0} bytes)`);
                    toolFeedback += `[Workspace Files]:\n${uniqueFiles.join('\n') || '(empty)'}\n\n`;
                  } else if (tc.name === 'workspace_write_file') {
                    const p = String(tc.args.path || '');
                    const c = String(tc.args.content || '');
                    if (p) registerFile(p, c);
                    toolFeedback += `[File "${tc.args.path}" written successfully to workspace sandbox. You MUST now call workspace_present_file to present it as an artifact in the user drawer].\n`;
                  } else if (tc.name === 'workspace_present_file') {
                    toolFeedback += `[Artifact "${tc.args.title}" presented in drawer. You MUST now provide your concise executive summary and Mermaid diagram in chat response].\n`;
                  } else {
                    toolFeedback += `[Tool "${tc.name}" executed successfully.]\n`;
                  }
                }
                toolFeedback += `\n[Think step-by-step inside <think>...</think> about your next action before calling tools or responding]\n`;

                currentMessages.push({ role: 'user', content: toolFeedback });
              }

              // Tools were executed this turn. Always continue to next turn so the model receives tool results
              // to either call subsequent tools (e.g. workspace_present_file) or write the final response.
              shouldContinue = true;
            } else if (isStallingPhrase) {
              // The model paused after just announcing a plan without calling tools
              currentMessages.push({
                role: 'assistant',
                content: turnRawContent || turnText,
              });
              currentMessages.push({
                role: 'user',
                content: `Please execute your plan immediately using your workspace tools:
1. Call read_skill if relevant.
2. Call workspace_write_file to write the complete specification to the workspace sandbox.
3. Call workspace_present_file to present it as an artifact.
4. Output your executive summary and Mermaid flowchart in your chat response.`,
              });
              shouldContinue = true;
            } else {
              shouldContinue = false;
            }
          }

          safeEnqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          safeClose();
        } catch (streamErr: unknown) {
          safeEnqueue(
            encoder.encode(
              JSON.stringify({
                type: 'error',
                message: streamErr instanceof Error ? streamErr.message : String(streamErr),
              }) + '\n'
            )
          );
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: unknown) {
    const errorObj = err as Error & { cause?: unknown };
    console.error('[API /api/chat error]:', errorObj);
    const causeMsg = errorObj?.cause ? ` (Cause: ${errorObj.cause instanceof Error ? errorObj.cause.message : JSON.stringify(errorObj.cause)})` : '';
    const fullMsg = (errorObj?.message || 'Internal server error') + causeMsg;
    return NextResponse.json(
      { error: fullMsg },
      { status: 500 }
    );
  }
}
