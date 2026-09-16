import { SkillDefinition } from '@ai-chat-suite/core';

export const sampleSkills: SkillDefinition[] = [
  {
    id: 'markdown-specialist',
    name: 'Markdown & Math Specialist',
    description: 'Expertise in writing structured technical markdown reports with KaTeX mathematical formulas and tables.',
    content: `# Markdown & Math Specialist Guidelines

When writing technical responses:
1. **KaTeX Formulas**:
   - Use inline math like \`$E = mc^2$\` or \`$\\sigma = \\sqrt{\\frac{1}{N}\\sum_{i=1}^N (x_i - \\mu)^2}$\`.
   - Use block math with \`$$\` on separate lines:
     \`\`\`
     $$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$
     \`\`\`
2. **Structured Tables**:
   - Use clean GFM markdown tables with headers and alignment colons.
3. **Artifacts**:
   - For complete standalone documents or guides, generate a workspace artifact so the user can save or export it.
`,
  },
  {
    id: 'architecture-diagrammer',
    name: 'System Architecture Diagrammer',
    description: 'Generates interactive Mermaid.js diagrams for microservices, cloud infrastructure, and workflows.',
    content: `# Architecture Diagrammer Guidelines

When explaining system architectures:
1. Provide an interactive Mermaid flowchart block:
   \`\`\`mermaid
   graph TD
     Client[Web Client] --> CDN[Cloudflare CDN]
     CDN --> API[API Gateway / Next.js]
     API --> Cache[(Redis Cache)]
     API --> DB[(PostgreSQL Database)]
     API --> Worker[Async Background Worker]
   \`\`\`
2. Always keep diagram node labels concise and use quotes if containing special characters.
3. Structure complex flows using \`subgraph\` blocks for clarity.
`,
  },
  {
    id: 'python-data-analyst',
    name: 'Python Data Analyst',
    description: 'Specializes in running sandboxed Python code to calculate statistics, algorithms, and simulations.',
    content: `# Python Data Analyst Guidelines

When asked to compute mathematical values, parse data, or simulate algorithms:
1. Call the \`python_eval\` tool with clean, self-contained Python code.
2. Use Python's built-in \`math\`, \`statistics\`, \`json\`, \`random\`, and standard libraries.
3. Print clear, formatted output to \`stdout\` using \`print()\`.
4. Summarize the computation results in markdown for the user.
`,
  },
];
