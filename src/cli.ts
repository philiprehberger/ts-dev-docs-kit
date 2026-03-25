#!/usr/bin/env node

import { Command } from 'commander';
import prompts from 'prompts';
import { generateDocs } from './generator';
import { getAvailableStacks } from './templates';
import type { Stack } from './types';

const program = new Command();

program
  .name('dev-docs-kit')
  .description('Generate comprehensive development documentation for your project')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize documentation in the current directory')
  .option('-n, --name <name>', 'Project name')
  .option('-s, --stack <stack>', 'Tech stack (fastify-prisma)')
  .option('-o, --output <dir>', 'Output directory', process.cwd())
  .option('--no-plans', 'Skip plan templates')
  .option('--no-issues', 'Skip issue tracking structure')
  .action(async (options) => {
    try {
      let projectName = options.name;
      let stack = options.stack as Stack | undefined;

      // Interactive prompts if options not provided
      if (!projectName || !stack) {
        const response = await prompts([
          {
            type: projectName ? null : 'text',
            name: 'projectName',
            message: 'Project name:',
            initial: 'my-project',
          },
          {
            type: stack ? null : 'select',
            name: 'stack',
            message: 'Select your tech stack:',
            choices: getAvailableStacks().map((s) => ({
              title: s,
              value: s,
            })),
          },
        ]);

        projectName = projectName || response.projectName;
        stack = stack || response.stack;
      }

      if (!projectName || !stack) {
        console.error('❌ Project name and stack are required');
        process.exit(1);
      }

      // Generate documentation
      generateDocs({
        projectName,
        stack,
        outputDir: options.output,
        includePlans: options.plans,
        includeIssues: options.issues,
      });

      console.log('\n✅ Documentation generated successfully!');
      console.log('\n📖 Next steps:');
      console.log('   1. Review docs/guides/INDEX.md for guide overview');
      console.log('   2. Customize guides to match your project');
      console.log('   3. Update docs/DOCS_GUIDE.md for your team');
      if (options.plans) {
        console.log('   4. Use plan templates in docs/plans/templates/');
      }
    } catch (error) {
      console.error('❌ Error generating documentation:', error);
      process.exit(1);
    }
  });

program
  .command('list-stacks')
  .description('List available tech stacks')
  .action(() => {
    const stacks = getAvailableStacks();
    console.log('Available stacks:');
    stacks.forEach((stack) => {
      console.log(`  - ${stack}`);
    });
  });

program.parse();
