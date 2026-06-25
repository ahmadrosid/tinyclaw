export interface SkillFrontmatter {
  name: string;
  description: string;
  /** When true, the skill only activates on explicit invocation (e.g. /skill name). */
  disableModelInvocation?: boolean;
}

export interface ParsedSkillFile {
  frontmatter: SkillFrontmatter;
  body: string;
  sourcePath: string;
}

export interface DiscoveredSkill {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  directory: string;
  skillFilePath: string;
  body: string;
  hasTool: boolean;
  toolPath: string | null;
}

export interface SkillMatchOptions {
  explicitOnly?: boolean;
}
