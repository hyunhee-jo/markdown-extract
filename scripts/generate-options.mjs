#!/usr/bin/env node

// AUTO-GENERATED CLI option bindings from options.json
// Usage: node scripts/generate-options.mjs [--dry-run]

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toSnakeCase,
  readOptions,
  LIST_OPTIONS,
  getPythonType,
  getPythonDefault,
} from './utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const HEADER = `# AUTO-GENERATED FROM options.json - DO NOT EDIT DIRECTLY
# Run \`npm run generate-options\` to regenerate
`;

async function main() {
  const data = await readOptions(resolve(ROOT, 'options.json'));
  const options = data.options;

  // Generate Python CLI options metadata
  const pyMeta = generatePythonMetadata(options);
  const pyMetaPath = resolve(ROOT, 'src/markdown_extract/cli_options_generated.py');

  if (DRY_RUN) {
    console.log('=== cli_options_generated.py ===');
    console.log(pyMeta);
    console.log('\n[dry-run] No files written.');
  } else {
    await writeFile(pyMetaPath, pyMeta, 'utf-8');
    console.log(`Written: ${pyMetaPath}`);
  }
}

function generatePythonMetadata(options) {
  const lines = [
    HEADER,
    'from __future__ import annotations',
    '',
    '',
    'CLI_OPTIONS = [',
  ];

  for (const opt of options) {
    const snake = toSnakeCase(opt.name);
    const isList = LIST_OPTIONS.has(opt.name);
    lines.push('    {');
    lines.push(`        "name": "${opt.name}",`);
    lines.push(`        "snake_name": "${snake}",`);
    if (opt.shortName) {
      lines.push(`        "short_name": "${opt.shortName}",`);
    } else {
      lines.push('        "short_name": None,');
    }
    lines.push(`        "type": "${opt.type}",`);
    lines.push(`        "is_list": ${isList ? 'True' : 'False'},`);
    lines.push(`        "required": ${opt.required ? 'True' : 'False'},`);
    if (opt.default === null) {
      lines.push('        "default": None,');
    } else if (opt.type === 'boolean') {
      lines.push(`        "default": ${opt.default ? 'True' : 'False'},`);
    } else {
      lines.push(`        "default": "${opt.default}",`);
    }
    lines.push(`        "description": "${opt.description.replace(/"/g, '\\"')}",`);
    lines.push('    },');
  }

  lines.push(']');
  lines.push('');
  lines.push('');
  lines.push('def add_options_to_parser(parser):');
  lines.push('    """Add all CLI options from options.json to an argparse parser."""');
  lines.push('    for opt in CLI_OPTIONS:');
  lines.push('        flags = []');
  lines.push('        if opt["short_name"]:');
  lines.push('            flags.append(f"-{opt[\\"short_name\\"]}")');
  lines.push('        flags.append(f"--{opt[\\"name\\"]}")');
  lines.push('        kwargs = {"help": opt["description"]}');
  lines.push('        if opt["type"] == "boolean":');
  lines.push('            kwargs["action"] = "store_true"');
  lines.push('            kwargs["default"] = opt["default"]');
  lines.push('        else:');
  lines.push('            kwargs["default"] = opt["default"]');
  lines.push('        parser.add_argument(*flags, **kwargs)');
  lines.push('');

  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
