import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { loadTemplate } from './templates';
import { replaceVariables, createTemplateVariables } from './replacer';
import type { GenerateOptions } from './types';

export function generateDocs(options: GenerateOptions): void {
  const { projectName, stack, outputDir, includePlans = true, includeIssues = true } = options;

  // Validate output directory
  if (!existsSync(outputDir)) {
    throw new Error(`Output directory does not exist: ${outputDir}`);
  }

  // Load templates
  const templates = loadTemplate(stack);
  const variables = createTemplateVariables(projectName);

  // Create directory structure
  const docsDir = join(outputDir, 'docs');
  const guidesDir = join(docsDir, 'guides');
  const plansDir = join(docsDir, 'plans');
  const issuesDir = join(docsDir, 'issues');

  mkdirSync(docsDir, { recursive: true });
  mkdirSync(guidesDir, { recursive: true });

  if (includePlans) {
    mkdirSync(plansDir, { recursive: true });
    mkdirSync(join(plansDir, 'templates'), { recursive: true });
    mkdirSync(join(plansDir, 'archive'), { recursive: true });
    mkdirSync(join(plansDir, 'backlog'), { recursive: true });
    mkdirSync(join(plansDir, 'reports'), { recursive: true });
  }

  if (includeIssues) {
    mkdirSync(issuesDir, { recursive: true });
    mkdirSync(join(issuesDir, 'resolved'), { recursive: true });
  }

  // Generate files
  let filesCreated = 0;

  for (const template of templates) {
    // Skip plan templates if not included
    if (!includePlans && template.relativePath.startsWith('plans/')) {
      continue;
    }

    // Process content with variable replacements
    const processedContent = replaceVariables(template.content, variables);

    // Determine output path
    const outputPath = join(docsDir, template.relativePath);

    // Create parent directories
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write file
    writeFileSync(outputPath, processedContent, 'utf-8');
    filesCreated++;
  }

  // Copy DOCS_GUIDE.md to docs/
  const docsGuideTemplate = templates.find(t => t.relativePath === 'DOCS_GUIDE.md');
  if (docsGuideTemplate) {
    const processedContent = replaceVariables(docsGuideTemplate.content, variables);
    writeFileSync(join(docsDir, 'DOCS_GUIDE.md'), processedContent, 'utf-8');
    filesCreated++;
  }

  console.log(`✨ Generated ${filesCreated} documentation files in ${docsDir}`);
  console.log(`   📚 Guides: ${guidesDir}`);
  if (includePlans) {
    console.log(`   📋 Plans: ${plansDir}`);
  }
  if (includeIssues) {
    console.log(`   🐛 Issues: ${issuesDir}`);
  }
}
