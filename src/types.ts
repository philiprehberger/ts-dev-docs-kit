export type Stack = 'fastify-prisma';

export interface GenerateOptions {
  projectName: string;
  stack: Stack;
  outputDir: string;
  includePlans?: boolean;
  includeIssues?: boolean;
}

export interface TemplateFile {
  relativePath: string;
  content: string;
}

export interface TemplateVariables {
  projectName: string;
  projectNameCamelCase: string;
  projectNamePascalCase: string;
  projectNameKebabCase: string;
  currentDate: string;
  currentYear: string;
}
