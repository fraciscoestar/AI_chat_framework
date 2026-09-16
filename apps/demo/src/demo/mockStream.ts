import { ChatPayload, ChatStreamEvent } from '@ai-chat-suite/core';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rich AI Stream Simulator
 * Enables zero-key local testing of all framework capabilities:
 * - Chain of thought reasoning (`thinking-delta`)
 * - Skill discovery and reading (`read_skill`)
 * - Sandboxed Python execution (`python_eval`)
 * - Artifact creation (`artifact-create`)
 * - Mermaid diagrams and KaTeX formulas
 */
export async function* simulateChatStream(payload: ChatPayload): AsyncIterable<ChatStreamEvent> {
  const prompt = payload.currentPrompt.toLowerCase();

  // 1. Emit Thinking Process
  yield {
    type: 'thinking-delta',
    delta: 'Analyzing user prompt and available skills in catalog...\n',
  };
  await delay(200);

  if (
    prompt.includes('microelectronic') ||
    prompt.includes('semiconductor') ||
    prompt.includes('device') ||
    prompt.includes('sensor') ||
    prompt.includes('expand') ||
    prompt.includes('comprehensive') ||
    prompt.includes('timeline') ||
    prompt.includes('chain') ||
    prompt.includes('execution')
  ) {
    // 0. Ensure base document exists in VFS for editing
    const initialDoc = `# Microelectronics and Sensor Technology Guide

## 1. Introduction
Modern microelectronics integrates semiconductor physics with microelectromechanical systems (MEMS).

## 2. Foundational Principles
### 2.1 Thermal Oxidation
Basic Deal-Grove oxidation growth model for silicon.
Wet and dry oxidation regimes.
Temperature-dependent oxide thickness.

### 2.2 Wet Chemical Etching
Isotropic and anisotropic etching reactions.
Silicon and dielectric etching chemistries.
Etch rate selectivity.

### 2.3 Ion Implantation and Doping
Dopant species incorporation for P-type and N-type regions.

### 2.4 Process Quality Control
Verification of doping profiles and junction depths when needed.

## 3. Operating Principles of Devices and Sensors
### 3.1 Transistors
- BJT
- MOSFET
- JFET

### 3.2 Sensors
- Gas sensors
- Radiation detectors
- MEMS Accelerometers
- MEMS Gyroscopes
`;

    yield {
      type: 'tool-call',
      id: `call_init_${Date.now()}`,
      name: 'workspace_write_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        content: initialDoc,
      },
    };
    await delay(200);

    // Group 1: Read file (Auto-summarizes to "Read 1 file")
    yield {
      type: 'tool-call',
      id: `call_read1_${Date.now()}`,
      name: 'workspace_read_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Read file',
      },
    };
    await delay(300);

    // Commentary 1
    const comm1 = 'I will insert detailed operating principle explanations for each semiconductor device, applying targeted diff edits on the existing guide.\n\n';
    for (const ch of comm1.split(' ')) {
      yield { type: 'text-delta', delta: ch + ' ' };
      await delay(20);
    }
    await delay(250);

    // Group 2: Edit file + 3 notes (Auto-summarizes to "1 file edited · 3 notes")
    yield {
      type: 'tool-call',
      id: `call_edit_pre_${Date.now()}`,
      name: 'workspace_edit_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Add physical mechanism of thermal oxidation (Deal-Grove model)',
        target_string: 'Basic Deal-Grove oxidation growth model for silicon.',
        replacement_string: 'Basic Deal-Grove oxidation growth model for silicon.\nDeal-Grove differential equation: x_0^2 + Ax_0 = B(t + \\tau).\nLinear regime dominated by surface reaction rate constant (B/A).\nParabolic regime dominated by oxidant diffusion coefficient (B).',
      },
    };
    await delay(300);

    yield {
      type: 'tool-call',
      id: `call_note1_${Date.now()}`,
      name: 'agent_note',
      args: {
        note: 'Verifying insertion points and chemical reagent tables',
      },
    };
    await delay(150);

    yield {
      type: 'tool-call',
      id: `call_note2_${Date.now()}`,
      name: 'agent_note',
      args: {
        note: 'Checking technical consistency with standard curriculum',
      },
    };
    await delay(150);

    yield {
      type: 'tool-call',
      id: `call_note3_${Date.now()}`,
      name: 'agent_note',
      args: {
        note: 'Structure prepared for etch procedures',
      },
    };
    await delay(250);

    // Commentary 2
    const comm2 = 'I will also add deeper physical fundamentals to the foundational sections (oxidation kinetics, wet etching, and ion implantation) to maintain rigorous technical depth throughout.\n\n';
    for (const ch of comm2.split(' ')) {
      yield { type: 'text-delta', delta: ch + ' ' };
      await delay(20);
    }
    await delay(250);

    // Group 3: Vertical timeline matching the Claude layout
    // Step 1: Read
    yield {
      type: 'tool-call',
      id: `call_r1_${Date.now()}`,
      name: 'workspace_read_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'View oxidation, etch, and doping sections to locate insertion points',
      },
    };
    await delay(250);

    // Step 2: Read
    yield {
      type: 'tool-call',
      id: `call_r2_${Date.now()}`,
      name: 'workspace_read_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'View thermal oxidation subsection',
      },
    };
    await delay(250);

    // Step 3: Edit
    yield {
      type: 'tool-call',
      id: `call_e1_${Date.now()}`,
      name: 'workspace_edit_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Add physical mechanism of thermal oxidation (Deal-Grove model)',
        target_string: 'Temperature-dependent oxide thickness.',
        replacement_string: 'Temperature-dependent oxide thickness with Arrhenius activation energy.\nThin oxide kinetics in dry oxygen ambient (O2).\nPartial pressure influence of steam vapor (H2O).\nInterface Si/SiO2 passivating trap density optimization.',
      },
    };
    await delay(300);

    // Step 4: Edit
    yield {
      type: 'tool-call',
      id: `call_e2_${Date.now()}`,
      name: 'workspace_edit_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Add common wet chemical etching table',
        target_string: 'Isotropic and anisotropic etching reactions.\nSilicon and dielectric etching chemistries.\nEtch rate selectivity.',
        replacement_string: `Cleanroom wet chemical etching chemistries and selectivity:
| Target Material | Typical Reagent | Operating Temp | Selectivity / Key Mechanism |
| :--- | :--- | :--- | :--- |
| Silicon (100) | KOH (30-40%) | 80°C | Anisotropic etch; (111) planes act as etch stop |
| Silicon (100) | TMAH (25%) | 85°C | CMOS compatible; zero ionic alkali metal contamination |
| Silicon Dioxide (SiO2) | BHF / BOE (7:1) | 25°C (Ambient) | Uniform buffered oxide etch with surfactant |
| Silicon Nitride (Si3N4) | Hot H3PO4 (85%) | 160°C | High selectivity over SiO2 (>10:1) |
| Aluminum Metallization | H3PO4/HNO3/CH3COOH | 45°C | Interconnect pad and line definition |`,
      },
    };
    await delay(350);

    // Step 5: Edit
    yield {
      type: 'tool-call',
      id: `call_e3_${Date.now()}`,
      name: 'workspace_edit_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Add physical mechanism of diffusion and implantation',
        target_string: 'Dopant species incorporation for P-type and N-type regions.',
        replacement_string: `Dopant species incorporation for P-type (Boron) and N-type (Phosphorus, Arsenic).
Fundamental physics: thermal diffusion governed by Fick's laws vs. ion implantation (projected range Rp and lateral straggle \\Delta Rp).
Rapid thermal annealing (RTA) for electrical dopant activation and crystalline lattice damage repair.`,
      },
    };
    await delay(300);

    // Step 6: Edit
    yield {
      type: 'tool-call',
      id: `call_e4_${Date.now()}`,
      name: 'workspace_edit_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Fix typo (quando -> when)',
        target_string: 'Verification quando sea necesario de los perfiles.',
        replacement_string: 'Verification of doping profiles and junction depths when needed.',
      },
    };
    await delay(250);

    // Step 7: Note
    yield {
      type: 'tool-call',
      id: `call_n1_${Date.now()}`,
      name: 'agent_note',
      args: {
        note: 'Reviewing index to update if needed and verifying full document integrity before republishing.',
      },
    };
    await delay(200);

    // Step 8: Command
    yield {
      type: 'tool-call',
      id: `call_c1_${Date.now()}`,
      name: 'python_eval',
      args: {
        command: 'Verify length, diagram/table count, and heading structure after edits',
        code: 'print("Validating document coherence: 854 lines, 13 diagrams, 28 tables")',
      },
    };
    await delay(350);

    // Step 9: Note
    yield {
      type: 'tool-call',
      id: `call_n2_${Date.now()}`,
      name: 'agent_note',
      args: {
        note: 'Structure remains consistent (854 lines, 13 diagrams, 28 tables). Copying updated version to output.',
      },
    };
    await delay(200);

    // Step 10: Command
    yield {
      type: 'tool-call',
      id: `call_c2_${Date.now()}`,
      name: 'python_eval',
      args: {
        command: 'Update final file in output directory',
        code: 'print("Output file synchronization complete")',
      },
    };
    await delay(350);

    // Step 11: Present file
    yield {
      type: 'tool-call',
      id: `call_pres_${Date.now()}`,
      name: 'workspace_present_file',
      args: {
        path: '/docs/microelectronics_guide.md',
        title: 'Microelectronics & Sensors Guide',
      },
    };
    await delay(300);

    // Response text
    const finalResponse = `I have added comprehensive "Operating Principle" sections for each semiconductor device and sensor prior to detailing its fabrication flow, while deepening the physical foundations. Specifically:

- **BJT**: Minority carrier injection and diffusion across the base, base transport factor, $\\beta$ gain, and the four operating quadrants (cutoff, forward-active, saturation, reverse-active).
- **MOSFET**: Strong inversion layer dynamics, linear and saturation regimes, channel length modulation, and enhancement vs. depletion mode trade-offs.
- **JFET**: Electrostatic depletion region modulation across the PN junction and pinch-off voltage behavior ($V_p$).
- **Gas Sensors**: Detailed physical transduction principles across 6 sensor classes (metal oxide band bending, electrochemical redox, NDIR Beer-Lambert optical absorption, acoustic wave gravimetric Sauerbrey equation, pellistor catalytic combustion, and conductive polymer charge transfer).
- **Radiation Detectors**: Electron-hole pair creation and drift collection in reverse-biased junctions ($PIN$, HPGe), scintillation luminescence, and Townsend gas avalanche in GM counters.
- **MEMS Accelerometers**: Second-order spring-mass-damper mechanical dynamics across capacitive differential sensing, piezoresistive strain gauges, piezoelectric crystals, and resonant beam topologies.
- **MEMS Gyroscopes & Microphones**: Coriolis acceleration coupling and acoustic diaphragm capacitive transduction.

I also integrated the Deal-Grove oxidation model, Bosch DRIE cyclic silicon etch chemistry, a comprehensive wet etch selectivity matrix (KOH, TMAH, BOE, $\\text{H}_3\\text{PO}_4$), and ion implantation Gaussian range profiles ($R_p$, $\\Delta R_p$). The document expands to 854 lines with 28 comparative tables and 13 Mermaid diagrams.`;

    for (const chunk of finalResponse.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(18);
    }
  } else if (prompt.includes('python') || prompt.includes('fibonacci') || prompt.includes('calc')) {
    yield {
      type: 'thinking-delta',
      delta: 'User requested numerical computation. Invoking sandboxed Python tool `python_eval`.\n',
    };
    await delay(300);

    // Call python_eval tool
    const pythonCode = `# Compute Fibonacci numbers and check primes
def is_prime(n):
    if n < 2: return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0: return False
    return True

fib = [0, 1]
for _ in range(18):
    fib.append(fib[-1] + fib[-2])

primes_in_fib = [x for x in fib if is_prime(x)]
print(f"First 20 Fibonacci: {fib}")
print(f"Prime Fibonacci numbers: {primes_in_fib}")
`;

    // Write computational script silently to workspace VFS without cluttering artifacts
    yield {
      type: 'tool-call',
      id: `call_write_${Date.now()}`,
      name: 'workspace_write_file',
      args: {
        path: '/scripts/fibonacci.py',
        content: pythonCode,
      },
    };
    await delay(400);

    // Call python_eval tool
    yield {
      type: 'tool-call',
      id: `call_eval_${Date.now()}`,
      name: 'python_eval',
      args: { code: pythonCode },
    };
    await delay(800);

    // Stream explanation
    const responseText = `I created the script \`/scripts/fibonacci.py\` in the workspace sandbox and executed it inside the browser's Pyodide sandbox environment.

### Results
The algorithm successfully computed the Fibonacci sequence and extracted the prime numbers:
- **Total terms computed**: 20
- **Identified prime Fibonacci numbers**: \`[2, 3, 5, 13, 89, 233, 1597]\`

The script remains stored internally in your workspace sandbox without cluttering your artifacts drawer.`;

    for (const chunk of responseText.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(25);
    }
  } else if (prompt.includes('edit') || prompt.includes('modify') || prompt.includes('update') || prompt.includes('patch')) {
    yield {
      type: 'thinking-delta',
      delta: 'User requested file modification. Using `workspace_edit_file` to edit `/docs/architecture_spec.md` with targeted string replacement.\n',
    };
    await delay(300);

    // First ensure file exists in case user jumped straight to edit
    yield {
      type: 'tool-call',
      id: `call_edit_${Date.now()}`,
      name: 'workspace_edit_file',
      args: {
        path: '/docs/architecture_spec.md',
        target_string: 'The system employs a multi-tiered, event-driven microservices architecture:',
        replacement_string: 'The system employs an enterprise-grade, high-throughput microservices architecture with real-time streaming:',
      },
    };
    await delay(500);

    const editResponse = `I have updated \`/docs/architecture_spec.md\` using \`workspace_edit_file\`.

The architecture overview section has been upgraded to:
> *"The system employs an enterprise-grade, high-throughput microservices architecture with real-time streaming"*

Because this document was presented in your artifacts drawer, the view has been reactively refreshed with the modifications.`;

    for (const chunk of editResponse.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(25);
    }
  } else if (prompt.includes('diagram') || prompt.includes('architecture') || prompt.includes('mermaid')) {
    yield {
      type: 'thinking-delta',
      delta: 'User requested architectural design. Reading `architecture-diagrammer` skill from catalog.\n',
    };
    await delay(250);

    // Read skill tool
    yield {
      type: 'tool-call',
      id: `call_${Date.now()}`,
      name: 'read_skill',
      args: { skillId: 'architecture-diagrammer' },
    };
    await delay(450);

    yield {
      type: 'thinking-delta',
      delta: 'Skill guidelines loaded. Creating architecture document in workspace `/docs/architecture_spec.md`...\n',
    };
    await delay(250);

    // Save document to workspace via workspace_write_file
    const artifactContent = `# Distributed Cloud Architecture Specification

## Architecture Overview
The system employs a multi-tiered, event-driven microservices architecture:

1. **Edge & CDN**: Cloudflare provides SSL termination, DDoS protection, and static caching.
2. **API Gateway**: Routes traffic and enforces rate limiting.
3. **AI Chat Engine**: Handles streaming generation, dynamic tool dispatch, and skills catalog.
4. **Sandboxed VFS**: Securely maintains tenant files and artifacts.

\`\`\`mermaid
flowchart LR
  User([End User]) --> App[AIChatSuite Component]
  App --> VFS[(Virtual Filesystem)]
  App --> PyWorker[Pyodide Worker]
  App --> Stream[Streaming AI API]
\`\`\`
`;

    yield {
      type: 'tool-call',
      id: `call_write_${Date.now()}`,
      name: 'workspace_write_file',
      args: {
        path: '/docs/architecture_spec.md',
        content: artifactContent,
      },
    };
    await delay(350);

    yield {
      type: 'thinking-delta',
      delta: 'Presenting `/docs/architecture_spec.md` to the user as an interactive artifact in the side drawer...\n',
    };
    await delay(200);

    // Explicitly present the file as an artifact using workspace_present_file
    yield {
      type: 'tool-call',
      id: `call_present_${Date.now()}`,
      name: 'workspace_present_file',
      args: {
        path: '/docs/architecture_spec.md',
        title: 'System Architecture Specification',
      },
    };
    await delay(300);

    const intro = `Here is the architectural overview for the modern microservices deployment:\n\n`;
    for (const chunk of intro.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(20);
    }

    const diagramText = `\`\`\`mermaid
graph TD
  subgraph Client Tier
    Web["Next.js Web App"]
    Mobile["Mobile Client"]
  end

  subgraph Gateway Tier
    CF["Cloudflare Edge CDN"]
    GW["API Gateway / Reverse Proxy"]
  end

  subgraph Service Mesh
    Auth["Auth Service (OAuth2)"]
    Chat["AI Chat Engine"]
    VFS["Sandboxed VFS Service"]
  end

  subgraph Persistence
    DB[("PostgreSQL")]
    Redis[("Redis Session Cache")]
    S3[("Object Storage (Artifacts)")]
  end

  Web --> CF
  Mobile --> CF
  CF --> GW
  GW --> Auth
  GW --> Chat
  GW --> VFS

  Auth --> DB
  Chat --> Redis
  VFS --> S3
\`\`\`\n\n`;

    for (const chunk of diagramText.split('\n')) {
      yield { type: 'text-delta', delta: chunk + '\n' };
      await delay(40);
    }

    const followUp = `I have created and saved the comprehensive architecture specification in your workspace at \`/docs/architecture_spec.md\` and presented it in your artifacts drawer on the right.`;
    for (const chunk of followUp.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(20);
    }
  } else if (prompt.includes('math') || prompt.includes('scholes') || prompt.includes('formula') || prompt.includes('katex')) {
    yield {
      type: 'thinking-delta',
      delta: 'Consulting `markdown-specialist` skill for rigorous mathematical formatting with KaTeX.\n',
    };
    await delay(300);

    yield {
      type: 'tool-call',
      id: `call_${Date.now()}`,
      name: 'read_skill',
      args: { skillId: 'markdown-specialist' },
    };
    await delay(400);

    const mathResponse = `The **Black-Scholes model** is a mathematical framework for pricing European options contracts.

### Analytical Formula
The price of a European call option $C(S_t, t)$ with strike price $K$ and expiration date $T$ is:

$$C(S_t, t) = S_t N(d_1) - K e^{-r(T-t)} N(d_2)$$

Where the terms $d_1$ and $d_2$ are defined as:

$$d_1 = \\frac{\\ln(S_t / K) + \\left(r + \\frac{\\sigma^2}{2}\\right)(T - t)}{\\sigma \\sqrt{T - t}}$$

$$d_2 = d_1 - \\sigma \\sqrt{T - t} = \\frac{\\ln(S_t / K) + \\left(r - \\frac{\\sigma^2}{2}\\right)(T - t)}{\\sigma \\sqrt{T - t}}$$

### Parameter Definitions
| Symbol | Meaning | Value |
| :--- | :--- | :--- |
| $S_t$ | Current Spot Price of Underlying | $100.00 |
| $K$ | Strike / Exercise Price | $105.00 |
| $r$ | Risk-Free Interest Rate | $5.0\\%$ |
| $\\sigma$ | Annualized Asset Volatility | $20.0\\%$ |
| $T - t$ | Time to Expiration in Years | $0.5\\text{ years}$ |
| $N(\\cdot)$ | Cumulative Distribution of Standard Normal | - |
`;

    for (const chunk of mathResponse.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(25);
    }
  } else if (prompt.includes('kicad') || prompt.includes('schematic') || prompt.includes('circuit')) {
    yield {
      type: 'thinking-delta',
      delta: 'Detected custom hardware schematic request. Utilizing custom KiCad renderer plugin.\n',
    };
    await delay(300);

    const kicadCode = `U1: LM7805 5V Linear Voltage Regulator
C1: 10uF Electrolytic Capacitor (Input Filter)
C2: 0.1uF Ceramic Capacitor (Output Decoupling)
D1: 1N4007 Reverse Polarity Protection Diode
R1: 330 Ohm Current Limiting Resistor
LED1: Green Power Indicator LED`;

    yield {
      type: 'tool-call',
      id: `call_write_${Date.now()}`,
      name: 'workspace_write_file',
      args: {
        path: '/hardware/power_supply.kicad_sch',
        content: kicadCode,
      },
    };
    await delay(300);

    yield {
      type: 'tool-call',
      id: `call_present_${Date.now()}`,
      name: 'workspace_present_file',
      args: {
        path: '/hardware/power_supply.kicad_sch',
        title: '5V Regulator Circuit',
      },
    };
    await delay(300);

    const text = `Here is the schematic diagram rendered via the registered **KiCad Custom Renderer Plugin**:

\`\`\`kicad
${kicadCode}
\`\`\`

The schematic file \`/hardware/power_supply.kicad_sch\` has been saved in your workspace and presented in the right-hand artifact viewer.`;

    for (const chunk of text.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(25);
    }
  } else {
    // General conversational response
    const defaultResponse = `Hello! I am your AI assistant powered by the **AI Chat Framework**.

I have full support for:
- 📊 **Interactive Diagrams**: Generating Mermaid.js flowcharts, state machines, and sequence diagrams.
- 📐 **KaTeX Mathematical Typesetting**: Rendering inline formulas like $e^{i\\pi} + 1 = 0$ and complex equations.
- 🐍 **Sandboxed Python Code**: Executing calculations in a secure in-browser WebWorker sandbox.
- 🗂️ **Sandboxed Workspace & Artifacts**: Creating and editing documents viewable in the collapsible right drawer.
- 🎯 **Pluggable Skills**: Consulting domain skills on demand.

Try asking me to:
1. *"Write an architecture diagram for an e-commerce platform"*
2. *"Calculate prime numbers using Python"*
3. *"Explain the Black-Scholes formula with math equations"*
4. *"Create a project plan artifact in markdown"*
5. *"Expand the document details to be more comprehensive and include brief operating principles for each device/sensor"* (Claude-style execution chain with diffs & timeline)`;

    for (const chunk of defaultResponse.split(' ')) {
      yield { type: 'text-delta', delta: chunk + ' ' };
      await delay(25);
    }
  }

  yield { type: 'done' };
}
