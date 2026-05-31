import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../../dist/index.js');

describe('@philiprehberger/dev-docs-kit', () => {
  it('getAvailableStacks returns a non-empty array', () => {
    const stacks = mod.getAvailableStacks();
    assert.ok(Array.isArray(stacks));
    assert.ok(stacks.length > 0);
  });

  it('replaceVariables substitutes documented placeholders', () => {
    const result = mod.replaceVariables('Hello {{projectName}}', {
      projectName: 'World',
      projectNameCamelCase: 'world',
      projectNamePascalCase: 'World',
      projectNameKebabCase: 'world',
      currentDate: '2026-01-01',
      currentYear: '2026',
    });
    assert.equal(result, 'Hello World');
  });

  it('getAvailableVariables exposes all documented variable keys', () => {
    const vars = mod.getAvailableVariables();
    const expectedKeys = [
      'projectName',
      'projectNameCamelCase',
      'projectNamePascalCase',
      'projectNameKebabCase',
      'currentDate',
      'currentYear',
    ];
    for (const key of expectedKeys) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(vars, key),
        `Expected key "${key}" in getAvailableVariables() output`,
      );
      assert.equal(typeof vars[key], 'string');
    }
  });
});
