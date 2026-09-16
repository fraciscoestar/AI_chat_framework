import { ToolDefinition, ToolExecutionRequest, ToolExecutionResult, ToolExecutor } from '../types/tools';
import { VirtualFileSystem } from '../workspace/vfs';
import { PythonRunner } from '../workspace/pythonRunner';
import { SkillManager } from '../skills/skillManager';
import { ArtifactType, VirtualArtifact } from '../types/workspace';

export class ToolManager {
  private vfs?: VirtualFileSystem;
  private pythonRunner?: PythonRunner;
  private skillManager?: SkillManager;
  private onPresentArtifact?: (artifact: VirtualArtifact) => void;
  private onUpdateArtifactFile?: (path: string, newContent: string) => void;
  private customTools: Map<string, { definition: ToolDefinition; executor: ToolExecutor }> = new Map();

  constructor(options?: {
    vfs?: VirtualFileSystem;
    pythonRunner?: PythonRunner;
    skillManager?: SkillManager;
    onPresentArtifact?: (artifact: VirtualArtifact) => void;
    onUpdateArtifactFile?: (path: string, newContent: string) => void;
  }) {
    this.vfs = options?.vfs;
    this.pythonRunner = options?.pythonRunner;
    this.skillManager = options?.skillManager;
    this.onPresentArtifact = options?.onPresentArtifact;
    this.onUpdateArtifactFile = options?.onUpdateArtifactFile;
  }

  setOnPresentArtifact(handler?: (artifact: VirtualArtifact) => void) {
    this.onPresentArtifact = handler;
  }

  setOnUpdateArtifactFile(handler?: (path: string, newContent: string) => void) {
    this.onUpdateArtifactFile = handler;
  }

  registerTool(definition: ToolDefinition, executor: ToolExecutor) {
    this.customTools.set(definition.name, { definition, executor });
  }

  getToolDefinitions(options?: { enableWorkspace?: boolean; enablePython?: boolean }): ToolDefinition[] {
    const list: ToolDefinition[] = [];

    // 1. Skill tool
    if (this.skillManager) {
      list.push(this.skillManager.getReadSkillToolDefinition());
    }

    // 2. Python tool
    if (options?.enablePython && this.pythonRunner) {
      list.push({
        name: 'python_eval',
        description: 'Execute Python code safely in the browser sandbox. Standard output, errors, and return values are captured.',
        isClientSide: true,
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The Python code to execute.',
            },
          },
          required: ['code'],
        },
      });
    }

    // 3. Workspace VFS tools
    if (options?.enableWorkspace && this.vfs) {
      list.push({
        name: 'workspace_write_file',
        description: 'Create or update a file in the user workspace sandbox. This stores internal files and scripts without cluttering the visible artifacts drawer.',
        isClientSide: true,
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The sandboxed file path, e.g., /analysis.md or /src/calc.py',
            },
            content: {
              type: 'string',
              description: 'The text content to write to the file.',
            },
          },
          required: ['path', 'content'],
        },
      });

      list.push({
        name: 'workspace_read_file',
        description: 'Read the text content of a file in the user workspace sandbox.',
        isClientSide: true,
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The sandboxed file path to read, e.g., /analysis.md',
            },
          },
          required: ['path'],
        },
      });

      list.push({
        name: 'workspace_list_files',
        description: 'List all files currently in the user workspace sandbox.',
        isClientSide: true,
        parameters: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'The directory path to list (defaults to root "/")',
            },
          },
        },
      });

      list.push({
        name: 'workspace_present_file',
        description: 'Present an existing file from the workspace as an interactive artifact in the chat feed and side drawer. Use this when you want the user to review, explore, or edit a generated document, script, or diagram.',
        isClientSide: true,
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path of the workspace file to present, e.g., /roadmap.md or /src/app.py',
            },
            title: {
              type: 'string',
              description: 'Optional human-readable title for the artifact (defaults to filename).',
            },
          },
          required: ['path'],
        },
      });

      list.push({
        name: 'workspace_edit_file',
        description: 'Edit an existing file in the workspace using either targeted string replacement or line-range replacement. Automatically syncs any presented artifact if the file is currently displayed.',
        isClientSide: true,
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path of the workspace file to edit, e.g., /script.py or /notes.md',
            },
            target_string: {
              type: 'string',
              description: 'For string replacement: The exact string within the file to replace.',
            },
            replacement_string: {
              type: 'string',
              description: 'For string replacement: The replacement string.',
            },
            start_line: {
              type: 'number',
              description: 'For line replacement: The 1-based start line number.',
            },
            end_line: {
              type: 'number',
              description: 'For line replacement: The 1-based end line number (inclusive).',
            },
            replacement_content: {
              type: 'string',
              description: 'For line replacement: The new content to replace the line range with.',
            },
          },
          required: ['path'],
        },
      });
    }

    list.push({
      name: 'agent_note',
      description: 'Record an intermediate thought, reasoning note, or verification checkpoint in the execution timeline.',
      parameters: {
        type: 'object',
        properties: {
          note: {
            type: 'string',
            description: 'The thought or verification note to display in the execution chain.',
          },
        },
        required: ['note'],
      },
    });

    // 4. Custom tools
    for (const { definition } of this.customTools.values()) {
      list.push(definition);
    }

    return list;
  }

  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const { name, args } = request;

    // 0. Agent note
    if (name === 'agent_note') {
      const note = String(args.note || args.text || '');
      return {
        id: request.id,
        name,
        result: { success: true, note },
        output: note,
      };
    }

    // 1. Skill reading
    if (name === 'read_skill' && this.skillManager) {
      return this.skillManager.executeReadSkill(request);
    }

    // 2. Python execution
    if (name === 'python_eval' && this.pythonRunner) {
      const code = String(args.code || '');
      return await this.pythonRunner.run(code);
    }

    // 3. Workspace write
    if (name === 'workspace_write_file' && this.vfs) {
      try {
        const path = String(args.path || '');
        const content = String(args.content || '');
        const file = await this.vfs.writeFile(path, content);
        this.onUpdateArtifactFile?.(path, content);
        return {
          id: request.id,
          name,
          result: { success: true, path: file.path, size: file.size },
          output: `File successfully saved to ${file.path} (${file.size} bytes)`,
        };
      } catch (err: unknown) {
        return {
          id: request.id,
          name,
          isError: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 4. Workspace read
    if (name === 'workspace_read_file' && this.vfs) {
      try {
        const path = String(args.path || '');
        const content = await this.vfs.readFile(path);
        return {
          id: request.id,
          name,
          result: { content, path },
          output: content,
        };
      } catch (err: unknown) {
        return {
          id: request.id,
          name,
          isError: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 5. Workspace list
    if (name === 'workspace_list_files' && this.vfs) {
      try {
        const dir = String(args.directory || '/');
        const files = await this.vfs.listFiles(dir);
        return {
          id: request.id,
          name,
          result: files.map((f) => ({ path: f.path, size: f.size, updatedAt: f.updatedAt })),
          output: files.map((f) => `- ${f.path} (${f.size} bytes)`).join('\n') || 'Workspace is empty.',
        };
      } catch (err: unknown) {
        return {
          id: request.id,
          name,
          isError: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 6. Workspace present file (Surfaces file to artifacts section)
    if (name === 'workspace_present_file' && this.vfs) {
      try {
        const path = String(args.path || '');
        const content = await this.vfs.readFile(path);
        const file = await this.vfs.stat(path);

        const filename = path.split('/').pop() || 'file';
        const ext = filename.split('.').pop()?.toLowerCase() || '';

        const language =
          ext === 'py' ? 'python' :
          ext === 'js' ? 'javascript' :
          ext === 'ts' ? 'typescript' :
          ext === 'tsx' ? 'tsx' :
          ext === 'jsx' ? 'jsx' :
          ext === 'json' ? 'json' :
          ext === 'html' ? 'html' :
          ext === 'css' ? 'css' :
          ext === 'md' ? 'markdown' :
          ext === 'kicad_sch' ? 'kicad_sch' :
          'text';

        const artifactType: ArtifactType =
          language === 'markdown' ? 'document' :
          language === 'html' ? 'application' :
          'code';

        const title = String(args.title || '') || filename;
        const artifactId = `art_${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const artifact: VirtualArtifact = {
          id: artifactId,
          title,
          filename,
          language,
          type: artifactType,
          content,
          createdAt: file ? file.updatedAt : Date.now(),
          updatedAt: file ? file.updatedAt : Date.now(),
          conversationId: request.conversationId,
        };

        this.onPresentArtifact?.(artifact);

        return {
          id: request.id,
          name,
          result: { success: true, artifactId, path, title },
          output: `File "${path}" has been presented to the user as artifact "${title}".`,
        };
      } catch (err: unknown) {
        return {
          id: request.id,
          name,
          isError: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 7. Workspace edit file (String replacement or line replacement)
    if (name === 'workspace_edit_file' && this.vfs) {
      try {
        const path = String(args.path || '');
        const currentContent = await this.vfs.readFile(path);
        let updatedContent = currentContent;

        const targetString = args.target_string !== undefined ? String(args.target_string) : undefined;
        const replacementString = args.replacement_string !== undefined ? String(args.replacement_string) : undefined;
        const startLine = typeof args.start_line === 'number' ? args.start_line : undefined;
        const endLine = typeof args.end_line === 'number' ? args.end_line : undefined;
        const replacementContent = args.replacement_content !== undefined ? String(args.replacement_content) : undefined;

        let linesAdded = 0;
        let linesRemoved = 0;

        if (targetString !== undefined && replacementString !== undefined) {
          if (!currentContent.includes(targetString)) {
            return {
              id: request.id,
              name,
              isError: true,
              error: `Target string was not found in "${path}". Ensure the target string matches existing code exactly.`,
            };
          }
          linesRemoved = targetString.split('\n').length;
          linesAdded = replacementString.split('\n').length;
          updatedContent = currentContent.replace(targetString, replacementString);
        } else if (startLine !== undefined && endLine !== undefined && replacementContent !== undefined) {
          const lines = currentContent.split('\n');
          if (startLine < 1 || endLine < startLine || startLine > lines.length) {
            return {
              id: request.id,
              name,
              isError: true,
              error: `Invalid line range [${startLine}, ${endLine}]. File "${path}" has ${lines.length} lines.`,
            };
          }
          const actualEnd = Math.min(endLine, lines.length);
          const replacementLines = replacementContent.split('\n');
          linesRemoved = actualEnd - startLine + 1;
          linesAdded = replacementLines.length;
          lines.splice(startLine - 1, actualEnd - startLine + 1, ...replacementLines);
          updatedContent = lines.join('\n');
        } else {
          return {
            id: request.id,
            name,
            isError: true,
            error: `Must provide either (target_string and replacement_string) for string replace, or (start_line, end_line, and replacement_content) for line replace.`,
          };
        }

        const file = await this.vfs.writeFile(path, updatedContent);
        this.onUpdateArtifactFile?.(path, updatedContent);

        return {
          id: request.id,
          name,
          result: {
            success: true,
            path: file.path,
            size: file.size,
            diff: { added: linesAdded, removed: linesRemoved },
          },
          output: `Successfully edited ${file.path} (${file.size} bytes). Diff: +${linesAdded} -${linesRemoved}`,
        };
      } catch (err: unknown) {
        return {
          id: request.id,
          name,
          isError: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // 8. Custom tools
    const custom = this.customTools.get(name);
    if (custom) {
      return await custom.executor(request);
    }

    return {
      id: request.id,
      name,
      isError: true,
      error: `Unknown tool "${name}".`,
    };
  }
}
