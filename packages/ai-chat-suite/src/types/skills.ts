export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface SkillDefinition extends SkillSummary {
  content: string; // The markdown instructions
  systemPromptAddition?: string;
  tools?: string[];
  metadata?: Record<string, unknown>;
}

export interface SkillReadRequest {
  skillId: string;
}

export interface SkillReadResponse {
  skillId: string;
  name: string;
  content: string;
}
