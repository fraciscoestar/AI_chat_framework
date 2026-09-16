import { SkillDefinition, SkillSummary } from '../types/skills';
import { ToolDefinition, ToolExecutionRequest, ToolExecutionResult } from '../types/tools';

export class SkillManager {
  private skills: Map<string, SkillDefinition> = new Map();

  constructor(initialSkills: SkillDefinition[] = []) {
    for (const skill of initialSkills) {
      this.skills.set(skill.id, skill);
    }
  }

  setSkills(skills: SkillDefinition[]) {
    this.skills.clear();
    for (const skill of skills) {
      this.skills.set(skill.id, skill);
    }
  }

  getSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  getSkill(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  getSummaries(): SkillSummary[] {
    return this.getSkills().map(({ id, name, description, tags }) => ({
      id,
      name,
      description,
      tags,
    }));
  }

  /**
   * Formats the skills catalog for system prompt injection.
   * This is token-efficient because only the name and description are injected up front.
   */
  formatCatalogForPrompt(): string {
    const skills = this.getSkills();
    if (skills.length === 0) return '';

    const lines = [
      '## Available Skills',
      'You have access to specialized skills that provide guidelines and domain instructions.',
      'When relevant to the user request, you can use the `read_skill` tool to read the full instructions of a skill before responding.',
      '<available_skills>',
    ];

    for (const skill of skills) {
      lines.push(`  <skill id="${skill.id}">`);
      lines.push(`    <name>${skill.name}</name>`);
      lines.push(`    <description>${skill.description}</description>`);
      lines.push('  </skill>');
    }

    lines.push('</available_skills>');
    return lines.join('\n');
  }

  /**
   * Returns the built-in `read_skill` tool definition.
   */
  getReadSkillToolDefinition(): ToolDefinition {
    const skillIds = Array.from(this.skills.keys());
    return {
      name: 'read_skill',
      description: 'Read the complete markdown instructions and documentation for a specified skill.',
      isClientSide: true,
      parameters: {
        type: 'object',
        properties: {
          skillId: {
            type: 'string',
            description: 'The unique ID of the skill to read',
            enum: skillIds.length > 0 ? skillIds : undefined,
          },
        },
        required: ['skillId'],
      },
    };
  }

  /**
   * Executes the `read_skill` tool.
   */
  executeReadSkill(request: ToolExecutionRequest): ToolExecutionResult {
    const skillId = String(request.args.skillId || '');
    const skill = this.getSkill(skillId);

    if (!skill) {
      return {
        id: request.id,
        name: 'read_skill',
        isError: true,
        error: `Skill with ID "${skillId}" not found. Available skills: ${Array.from(this.skills.keys()).join(', ')}`,
      };
    }

    return {
      id: request.id,
      name: 'read_skill',
      isError: false,
      result: {
        id: skill.id,
        name: skill.name,
        content: skill.content,
      },
      output: `### Skill: ${skill.name}\n\n${skill.content}`,
    };
  }
}
