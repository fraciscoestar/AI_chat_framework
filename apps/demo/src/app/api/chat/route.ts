import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      messages = [],
      currentPrompt = '',
      apiKey = '',
      endpointUrl = '',
      model = '',
    } = body;

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

    // Normalize and avoid duplicate consecutive messages
    const formattedMessages: Array<{ role: string; content: string }> = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })
    );

    // Only append currentPrompt if messages does not already end with it
    const lastMsg = formattedMessages[formattedMessages.length - 1];
    if (
      currentPrompt.trim() &&
      (!lastMsg || lastMsg.role !== 'user' || lastMsg.content.trim() !== currentPrompt.trim())
    ) {
      formattedMessages.push({ role: 'user', content: currentPrompt });
    }

    // Build payload
    let payloadBody: string;

    if (isAnthropic) {
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

      // Anthropic does not allow 'system' in messages; extract into system parameter
      const systemMessages = formattedMessages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n\n');

      const chatMessages = formattedMessages.filter(
        (m) => m.role === 'user' || m.role === 'assistant'
      );

      payloadBody = JSON.stringify({
        model: anthropicModel,
        max_tokens: 4096,
        stream: true,
        ...(systemMessages ? { system: systemMessages } : {}),
        messages: chatMessages,
      });
    } else {
      // Universal OpenAI-compatible payload (works with OpenAI, Ollama, OpenRouter, Groq, vLLM, LM Studio)
      payloadBody = JSON.stringify({
        model: selectedModel,
        stream: true,
        messages: formattedMessages,
      });
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
      return NextResponse.json(
        { error: `API Endpoint error (${response.status}): ${parsedError}` },
        { status: response.status }
      );
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

        try {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let isFinished = false;

          // Clean up upstream if client aborts request
          req.signal.addEventListener('abort', () => {
            reader.cancel().catch(() => {});
            safeClose();
          });

          while (!isFinished) {
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
                isFinished = true;
                break;
              }

              try {
                const parsed = JSON.parse(dataStr);

                // Anthropic message stop event
                if (parsed.type === 'message_stop') {
                  isFinished = true;
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
                    safeEnqueue(
                      encoder.encode(
                        JSON.stringify({ type: 'text-delta', delta: parsed.delta.text }) + '\n'
                      )
                    );
                  }
                } else if (parsed.choices && parsed.choices[0]?.delta) {
                  // Universal OpenAI-compatible stream format
                  const deltaObj = parsed.choices[0].delta;

                  // Reasoning / Thinking tokens (DeepSeek, o1, Ollama, Qwen, etc.)
                  const reasoningDelta = deltaObj.reasoning_content || deltaObj.reasoning;
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

                  // Content text tokens
                  if (deltaObj.content) {
                    safeEnqueue(
                      encoder.encode(
                        JSON.stringify({ type: 'text-delta', delta: deltaObj.content }) + '\n'
                      )
                    );
                  }
                }
              } catch {
                // Ignore chunk parse errors
              }
            }
          }

          // Cleanly cancel upstream reader if finished before connection EOF
          reader.cancel().catch(() => {});

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
