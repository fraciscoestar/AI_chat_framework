# AI Chat Framework

An embeddable, modular AI chat suite inspired by [Claude.ai](https://claude.ai). Designed as a reusable React package (`@ai-chat-suite/core`) that can be embedded into any Next.js or React web application, alongside an interactive Next.js 15 showcase playground.

---

## Key Features

- 💬 **Full Chat Suite**: User messages, streaming AI responses, thought process dropdown, and tool execution chips.
- 🗂️ **Collapsible Left Drawer**:
  - Chat history grouped into **user-named folders** (create, rename, delete folders, move chats).
  - Search and filter chats by title.
  - **Incognito / Ephemeral Mode**: Private sessions that do not persist to storage.
- 📦 **Collapsible Right Drawer (Artifacts & Workspace)**:
  - Automatically slides open when the AI creates documents or artifacts.
  - **Dual-View**: Tab for conversation-specific artifacts and tab for the broader sandboxed user workspace filesystem.
  - Interactive renderers with rendered vs source code toggle, download, and copy buttons.
- 📐 **Rich Extensible Rendering**:
  - **GitHub Flavored Markdown**: Tables, task lists, formatting.
  - **KaTeX Mathematics**: Inline `$E = mc^2$` and block `$$\int f(x)dx$$` formulas.
  - **Mermaid.js**: Interactive flowcharts, sequence diagrams, and architecture maps.
  - **Custom Renderer Plugins**: Register custom language code blocks (e.g. ````kicad`) and file extensions (`.kicad_sch`) to render custom React components.
- 🧠 **Two-Tier Skills System**:
  - Injects a token-efficient catalog (name + description) into the AI context.
  - The AI model uses the built-in `read_skill({ skillId })` tool to lazily read the complete markdown instructions only when needed.
- 🛡️ **Sandboxed User Workspace & Tools**:
  - Strictly isolated Virtual Filesystem (VFS) preventing directory traversal (`..`) or host escaping.
  - In-browser Python execution via Pyodide in a WebWorker (100% sandboxed, zero host risk).
- 🔌 **Pluggable Persistence Adapter**:
  - Default: `IndexedDBStorageAdapter` (stores history, folders, and files directly in the user's browser, partitioned by `userId`).
  - Pluggable `ChatStorageAdapter` interface for connecting custom backends (Supabase, Prisma, REST, etc.).
- ⚡ **Zero-Key Simulator + Live LLMs**:
  - Built-in rich simulator for immediate testing with zero API keys required.
  - Drop-in API route for Anthropic (Claude 3.5 Sonnet), OpenAI (GPT-4o), and Google Gemini.

---

## Monorepo Structure

```
AI_chat_framework/
├── packages/
│   └── ai-chat-suite/          # Core reusable React library (@ai-chat-suite/core)
│       ├── src/
│       │   ├── components/     # AIChatSuite, LeftSidebar, RightSidebar, Header, etc.
│       │   ├── rendering/      # MarkdownViewer, MermaidViewer, CodeViewer, Plugins
│       │   ├── skills/         # SkillManager (Two-tier catalog & read_skill)
│       │   ├── storage/        # IndexedDBStorageAdapter, MemoryStorageAdapter
│       │   ├── tools/          # ToolManager (Pyodide Python, VFS, custom tools)
│       │   ├── workspace/      # VirtualFileSystem (VFS with sandbox security)
│       │   └── types/          # TypeScript domain definitions
│       └── dist/               # Pre-bundled ESM + CJS + TypeScript DTS + CSS
└── apps/
    └── demo/                   # Next.js 15 App Router demo playground
        ├── src/
        │   ├── app/            # Demo page embedding <AIChatSuite /> & /api/chat route
        │   └── demo/           # Mock stream simulator, sample skills & KiCad renderer
```

---

## Quick Start (Demo Playground)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Start the Next.js demo development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Embedding in Your Project

### 1. Import Component & Styles

```tsx
import dynamic from 'next/dynamic';
import { ChatPayload, ChatStreamEvent, SkillDefinition } from '@ai-chat-suite/core';
import '@ai-chat-suite/core/styles.css';

// Client-side dynamic import (disables SSR for browser-only IndexedDB & WebWorkers)
const AIChatSuite = dynamic(
  () => import('@ai-chat-suite/core').then((m) => m.AIChatSuite),
  { ssr: false }
);
```

### 2. Embed the Component

```tsx
export default function ChatPage() {
  const handleSendMessage = async function* (payload: ChatPayload): AsyncIterable<ChatStreamEvent> {
    // Call your AI backend endpoint (e.g. Next.js API route)
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

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
        if (line.trim()) {
          yield JSON.parse(line.trim());
        }
      }
    }
  };

  return (
    <div className="h-screen w-screen">
      <AIChatSuite
        userId="user_12345"
        userDisplayName="Fraci"
        onSendMessage={handleSendMessage}
        workspaceEnabled={true}
        pythonExecutionEnabled={true}
        allowEphemeralChats={true}
        theme="system"
      />
    </div>
  );
}
```

---

## Adding Custom Skills

Parent applications can provide specialized skills as markdown files or objects:

```tsx
const skills: SkillDefinition[] = [
  {
    id: 'markdown-writer',
    name: 'Markdown & Math Specialist',
    description: 'Guidelines for formatting reports with KaTeX formulas and tables.',
    content: `# Markdown Writer Guidelines\n\nAlways use tables and KaTeX formulas like $E=mc^2$ when explaining physics.`,
  },
  {
    id: 'architecture-diagrammer',
    name: 'Architecture Diagrammer',
    description: 'Generates Mermaid.js diagrams for microservice architectures.',
    content: `# Mermaid Guidelines\n\nUse \`\`\`mermaid\ngraph TD... blocks.`,
  }
];

<AIChatSuite
  userId="user_123"
  skills={skills}
  onSendMessage={handleSendMessage}
/>
```

---

## Registering Custom Renderers

To render custom formats (e.g. KiCad schematics, interactive charts, CAD viewers):

```tsx
import { CustomRendererProps } from '@ai-chat-suite/core';

const MyKicadViewer: React.FC<CustomRendererProps> = ({ content, filename }) => {
  return (
    <div className="p-4 rounded-lg bg-sky-950 text-sky-200">
      <h4>KiCad Schematic: {filename}</h4>
      <pre>{content}</pre>
    </div>
  );
};

<AIChatSuite
  userId="user_123"
  renderers={{
    kicad: MyKicadViewer,
    kicad_sch: MyKicadViewer,
  }}
  onSendMessage={handleSendMessage}
/>
```

Any markdown code block with ````kicad ... ```` or any artifact file ending in `.kicad_sch` will automatically use `MyKicadViewer`!

---

## Storage Adapters

By default, `@ai-chat-suite/core` uses `IndexedDBStorageAdapter` to store conversations, user-created folders, and workspace files client-side.

To persist data to your backend database (PostgreSQL, Supabase, Prisma), implement the `ChatStorageAdapter` interface:

```typescript
import { ChatStorageAdapter, Conversation, Folder } from '@ai-chat-suite/core';

class BackendStorageAdapter implements ChatStorageAdapter {
  async getConversations(userId: string): Promise<Conversation[]> {
    const res = await fetch(`/api/users/${userId}/chats`);
    return res.json();
  }
  async saveConversation(userId: string, conv: Conversation): Promise<void> {
    await fetch(`/api/users/${userId}/chats/${conv.id}`, {
      method: 'PUT',
      body: JSON.stringify(conv),
    });
  }
  // Implement deleteConversation, getFolders, saveFolder, deleteFolder...
}

<AIChatSuite
  userId="user_123"
  storageAdapter={new BackendStorageAdapter()}
  onSendMessage={handleSendMessage}
/>
```

---

## Verification & Testing

Run the automated test suite:
```bash
npm test
```
Verifies:
- Virtual Filesystem (VFS) path traversal security (rejects `..`, Windows drives, null bytes).
- Memory & IndexedDB storage adapter operations (CRUD, folder assignment, ephemeral eviction).
- Two-tier skill discovery and on-demand tool execution.
