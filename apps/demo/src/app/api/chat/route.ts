import { NextRequest, NextResponse } from 'next/server';

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

    // Build payload
    let payloadBody: string;

    if (isAnthropic) {
      payloadBody = JSON.stringify({
        model: selectedModel.includes('claude') ? selectedModel : 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        stream: true,
        messages: [
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: currentPrompt },
        ],
      });
    } else {
      // Universal OpenAI-compatible payload (works with OpenAI, Ollama, OpenRouter, Groq, vLLM, LM Studio)
      payloadBody = JSON.stringify({
        model: selectedModel,
        stream: true,
        messages: [
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: currentPrompt },
        ],
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadBody,
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `API Endpoint error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
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
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr);

                // Anthropic message stream format
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  controller.enqueue(
                    encoder.encode(
                      JSON.stringify({ type: 'text-delta', delta: parsed.delta.text }) + '\n'
                    )
                  );
                } else if (parsed.choices && parsed.choices[0]?.delta) {
                  // Universal OpenAI-compatible stream format
                  const deltaObj = parsed.choices[0].delta;

                  // Reasoning / Thinking tokens (DeepSeek, o1, etc.)
                  if (deltaObj.reasoning_content) {
                    controller.enqueue(
                      encoder.encode(
                        JSON.stringify({
                          type: 'thinking-delta',
                          delta: deltaObj.reasoning_content,
                        }) + '\n'
                      )
                    );
                  }

                  // Content text tokens
                  if (deltaObj.content) {
                    controller.enqueue(
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

          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();
        } catch (streamErr: unknown) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'error',
                message: streamErr instanceof Error ? streamErr.message : String(streamErr),
              }) + '\n'
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
