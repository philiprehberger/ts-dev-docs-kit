import type { TemplateVariables } from './types';

export function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[A-Z]/, (chr) => chr.toLowerCase());
}

export function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, (chr) => chr.toUpperCase());
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function createTemplateVariables(projectName: string): TemplateVariables {
  const now = new Date();

  return {
    projectName,
    projectNameCamelCase: toCamelCase(projectName),
    projectNamePascalCase: toPascalCase(projectName),
    projectNameKebabCase: toKebabCase(projectName),
    currentDate: now.toISOString().split('T')[0],
    currentYear: now.getFullYear().toString(),
  };
}

export function replaceVariables(content: string, variables: TemplateVariables): string {
  let result = content;

  // Replace template variables
  result = result.replace(/\{\{projectName\}\}/g, variables.projectName);
  result = result.replace(/\{\{projectNameCamelCase\}\}/g, variables.projectNameCamelCase);
  result = result.replace(/\{\{projectNamePascalCase\}\}/g, variables.projectNamePascalCase);
  result = result.replace(/\{\{projectNameKebabCase\}\}/g, variables.projectNameKebabCase);
  result = result.replace(/\{\{currentDate\}\}/g, variables.currentDate);
  result = result.replace(/\{\{currentYear\}\}/g, variables.currentYear);

  return result;
}
