'use client';

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  ChatPayload,
  ChatStreamEvent,
  ModelOption,
} from '@ai-chat-suite/core';

const DEMO_MODELS: ModelOption[] = [
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    description: 'Most intelligent model for coding and complex analysis',
    badge: 'Hybrid Reasoning',
    effortLevels: [
      { id: 'low', label: 'Low', description: 'Quick responses with minimal thinking' },
      { id: 'medium', label: 'Medium', description: 'Balanced reasoning for standard tasks' },
      { id: 'high', label: 'High', description: 'Deep chain-of-thought analysis for complex problems' },
    ],
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    description: 'Fastest model for quick tasks and immediate answers',
    badge: 'Fast',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Omni multimodal flagship model by OpenAI',
    badge: 'Multimodal',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    description: 'Advanced open reasoning model with full chain-of-thought',
    badge: 'Reasoning',
    isSecondary: true,
    effortLevels: [
      { id: 'low', label: 'Low' },
      { id: 'high', label: 'High' },
    ],
  },
  {
    id: 'llama-3-3-70b',
    name: 'Llama 3.3 70B',
    description: 'Meta flagship open weights model',
    badge: 'Open Weights',
    isSecondary: true,
  },
];

const AIChatSuite = dynamic(
  () => import('@ai-chat-suite/core').then((m) => m.AIChatSuite),
  { ssr: false }
);
import { sampleSkills } from '../demo/sampleSkills';
import { KicadRenderer } from '../demo/sampleRenderers';
import { simulateChatStream } from '../demo/mockStream';
import {
  Settings,
  Sun,
  Moon,
  Bot,
  Zap,
  X,
  Sparkles,
  Key,
  Terminal,
  Globe,
  Layers,
} from 'lucide-react';

const DEMO_RENDERERS = {
  kicad: KicadRenderer,
  kicad_sch: KicadRenderer,
};

export default function DemoPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [mode, setMode] = useState<'simulator' | 'live'>('simulator');
  const [pythonEnabled, setPythonEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Live LLM custom configuration
  const [endpointUrl, setEndpointUrl] = useState('https://api.openai.com/v1/chat/completions');
  const [model, setModel] = useState('gpt-4o');
  const [selectedModelId, setSelectedModelId] = useState('claude-3-7-sonnet');
  const [apiKey, setApiKey] = useState('');

  // Persist dark mode across refreshes
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('ai_chat_theme') as 'dark' | 'light' | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      }

      // Also restore saved mode and live endpoint config if present
      const savedMode = localStorage.getItem('ai_chat_mode') as 'simulator' | 'live' | null;
      if (savedMode === 'simulator' | savedMode === 'live') setMode(savedMode);
      const savedEndpoint = localStorage.getItem('ai_chat_endpoint');
      if (savedEndpoint) setEndpointUrl(savedEndpoint);
      const savedModel = localStorage.getItem('ai_chat_model');
      if (savedModel) {
        setModel(savedModel);
        setSelectedModelId(savedModel);
      }
      const savedApiKey = localStorage.getItem('ai_chat_api_key');
      if (savedApiKey) setApiKey(savedApiKey);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('ai_chat_theme', next);
      } catch {
        // Ignore
      }
      return next;
    });
  };

  const handleSetMode = (newMode: 'simulator' | 'live') => {
    setMode(newMode);
    try {
      localStorage.setItem('ai_chat_mode', newMode);
    } catch {
      // Ignore
    }
  };

  const handleSaveEndpointConfig = () => {
    const trimmedModel = model.trim();
    try {
      localStorage.setItem('ai_chat_mode', mode);
      localStorage.setItem('ai_chat_endpoint', endpointUrl);
      localStorage.setItem('ai_chat_model', trimmedModel);
      if (apiKey) {
        localStorage.setItem('ai_chat_api_key', apiKey);
      } else {
        localStorage.removeItem('ai_chat_api_key');
      }
    } catch {
      // Ignore
    }
    if (trimmedModel) {
      setSelectedModelId(trimmedModel);
    }
    setShowSettings(false);
  };

  const handlePresetSelect = (presetUrl: string, presetModel: string) => {
    setEndpointUrl(presetUrl);
    setModel(presetModel);
    setSelectedModelId(presetModel);
  };

  // Dynamic models list: In live mode, expose the custom model in the picker if not already preset
  const currentModels = useMemo(() => {
    const trimmedModel = model.trim();
    if (mode === 'live' && trimmedModel && !DEMO_MODELS.some((m) => m.id === trimmedModel)) {
      return [
        {
          id: trimmedModel,
          name: trimmedModel,
          description: `Custom live model (${endpointUrl})`,
          badge: 'Custom Live',
        },
        ...DEMO_MODELS,
      ];
    }
    return DEMO_MODELS;
  }, [mode, model, endpointUrl]);

  // Streaming handler passed to <AIChatSuite />
  const handleSendMessage = useMemo(() => {
    return async function* (payload: ChatPayload): AsyncIterable<ChatStreamEvent> {
      if (mode === 'simulator') {
        yield* simulateChatStream(payload);
      } else {
        // In live mode, ensure the explicitly configured or selected model is actually used
        const targetModel =
          mode === 'live' && model.trim()
            ? model.trim()
            : (payload.model || selectedModelId || model);

        // Call /api/chat with custom endpoint URL and parameters
        let res: Response;
        try {
          res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: payload.messages,
              currentPrompt: payload.currentPrompt,
              endpointUrl,
              model: targetModel,
              effort: payload.effort,
              apiKey,
            }),
          });
        } catch (fetchErr: unknown) {
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          yield {
            type: 'error',
            message: `Connection failed: ${msg}. Check if your dev server or local network is reachable.`,
          };
          return;
        }

        if (!res.ok || !res.body) {
          let errorDetail = '';
          try {
            const errJson = await res.json();
            errorDetail = errJson.error || JSON.stringify(errJson);
          } catch {
            const rawText = await res.text().catch(() => '');
            errorDetail = rawText.slice(0, 300) || `HTTP ${res.status} ${res.statusText}`;
          }
          yield { type: 'error', message: errorDetail || `Failed to fetch from ${endpointUrl}` };
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const event: ChatStreamEvent = JSON.parse(line.trim());
                  yield event;
                  if (event.type === 'done') {
                    return;
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        } catch (streamReadErr) {
          // If stream ended after yielding events, do not crash on TCP connection termination
          console.debug('[handleSendMessage] Stream reader closed:', streamReadErr);
        }
      }
    };
  }, [mode, endpointUrl, model, apiKey, selectedModelId]);

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Top Demo Showcase Nav */}
      <header className="h-11 border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-[#121214]/90 px-4 flex items-center justify-between text-xs select-none z-30">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-500" />
            <span>AI Chat Suite</span>
            <span className="text-[10px] font-mono font-normal px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Demo
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1 border-l border-slate-300 dark:border-slate-700 pl-3">
            <button
              onClick={() => {
                handleSetMode('simulator');
                if (!DEMO_MODELS.some((m) => m.id === selectedModelId)) {
                  setSelectedModelId(DEMO_MODELS[0].id);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-colors ${
                mode === 'simulator'
                  ? 'bg-amber-600 text-white font-medium shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Bot className="w-3 h-3" />
              <span>Simulator Mode (No Keys)</span>
            </button>

            <button
              onClick={() => {
                handleSetMode('live');
                if (model.trim()) {
                  setSelectedModelId(model.trim());
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-colors ${
                mode === 'live'
                  ? 'bg-amber-600 text-white font-medium shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>Live Custom Endpoint</span>
            </button>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {/* Python Sandbox badge */}
          <button
            onClick={() => setPythonEnabled(!pythonEnabled)}
            className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
              pythonEnabled
                ? 'border-sky-300 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-400'
            }`}
            title="Toggle client-side Python execution"
          >
            <Terminal className="w-3 h-3" />
            <span>Pyodide: {pythonEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={handleToggleTheme}
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            title="Settings & Custom Endpoint"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Embedded Main Chat Suite Component */}
      <div className="flex-1 overflow-hidden relative">
        <AIChatSuite
          userId="demo-user-123"
          userDisplayName="Developer"
          onSendMessage={handleSendMessage}
          skills={sampleSkills}
          renderers={DEMO_RENDERERS}
          pythonExecutionEnabled={pythonEnabled}
          allowEphemeralChats={true}
          theme={theme}
          models={currentModels}
          selectedModelId={selectedModelId}
          onSelectModel={(id) => {
            setSelectedModelId(id);
            if (mode === 'live') {
              setModel(id);
            }
          }}
          allowRegeneration={true}
          allowEditingUserMessages={true}
        />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none">
          <div className="w-full max-w-lg bg-white dark:bg-[#1c1c1f] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
                <Settings className="w-4 h-4 text-amber-600" />
                <span>Custom API & Live Endpoint Settings</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Execution Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      handleSetMode('simulator');
                      if (!DEMO_MODELS.some((m) => m.id === selectedModelId)) {
                        setSelectedModelId(DEMO_MODELS[0].id);
                      }
                    }}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      mode === 'simulator'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>Simulator Mode</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Zero API keys needed
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleSetMode('live');
                      if (model.trim()) {
                        setSelectedModelId(model.trim());
                      }
                    }}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      mode === 'live'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>Live Endpoint Mode</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                      Connect to any LLM API URL
                    </div>
                  </button>
                </div>
              </div>

              {/* Endpoint Presets */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('https://api.openai.com/v1/chat/completions', 'gpt-4o')}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    OpenAI (GPT-4o)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('https://api.anthropic.com/v1/messages', 'claude-3-5-sonnet-20241022')}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    Anthropic (Claude 3.5)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('http://localhost:11434/v1/chat/completions', 'llama3')}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    Ollama (Local)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('https://openrouter.ai/api/v1/chat/completions', 'deepseek/deepseek-chat')}
                    className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] text-slate-700 dark:text-slate-300"
                  >
                    OpenRouter
                  </button>
                </div>
              </div>

              {/* Endpoint URL Input */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  API Endpoint URL
                </label>
                <div className="relative">
                  <Globe className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="https://api.openai.com/v1/chat/completions or http://localhost:11434/v1/chat/completions"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Model Name Input */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Model Identifier
                </label>
                <input
                  type="text"
                  placeholder="gpt-4o, llama3, deepseek-chat, etc."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
                />
              </div>

              {/* API Key Input */}
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  API Key (Optional for local Ollama/LM Studio)
                </label>
                <div className="relative">
                  <Key className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    placeholder="sk-... or Authorization token"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono text-[11px]"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  API keys are held in memory during the session and sent securely via server proxy.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleSaveEndpointConfig}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
