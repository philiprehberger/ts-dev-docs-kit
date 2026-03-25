import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Stack, TemplateFile } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getAvailableStacks(): Stack[] {
  return ['fastify-prisma'];
}

export function getTemplateDir(stack: Stack): string {
  return join(__dirname, 'templates', stack);
}

export function loadTemplate(stack: Stack): TemplateFile[] {
  const templateDir = getTemplateDir(stack);
  const files: TemplateFile[] = [];

  function walkDir(dir: string) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (stat.isFile() && entry.endsWith('.md')) {
        const content = readFileSync(fullPath, 'utf-8');
        const relativePath = relative(templateDir, fullPath);
        files.push({ relativePath, content });
      }
    }
  }

  walkDir(templateDir);
  return files;
}
