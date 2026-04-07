#!/usr/bin/env node

// Generate LangChain wrapper code from options.json
// Usage:
//   node scripts/generate-langchain.mjs \
//     --options options.json \
//     --target <document_loaders.py> \
//     --readme <README.md> \
//     --version <VERSION> \
//     --pr-body <output.md> \
//     --dry-run

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  toSnakeCase,
  readOptions,
  LIST_OPTIONS,
  getPythonType,
  getPythonDefault,
  escapeMarkdown,
  replaceMarkerBlock,
} from './utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config (hardcoded, no separate config file) ---
const EXCLUDE_OPTIONS = ['output-dir'];
const DEFAULT_OVERRIDES = {
  'format': '"text"',  // Wrapper default: text (upstream: json) for RAG use case
};
const TYPE_OVERRIDES = {
  'format': 'str',  // Wrapper accepts single format only
};
// ---

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i].startsWith('--') && i + 1 < argv.length) {
      const key = argv[i].slice(2);
      args[key] = argv[++i];
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = args.dryRun || false;

  const optionsPath = args.options || resolve(__dirname, '..', 'options.json');
  const targetPath = args.target;
  const readmePath = args.readme;
  const version = args.version || '0.0.0';
  const prBodyPath = args['pr-body'];

  if (!targetPath) {
    console.error('Error: --target <document_loaders.py> is required');
    process.exit(1);
  }

  // 1. Read options.json
  const data = await readOptions(optionsPath);
  const allOptions = data.options.filter(opt => !EXCLUDE_OPTIONS.includes(opt.name));

  // 2. Read current target file (for breaking change detection)
  let targetContent;
  try {
    targetContent = await readFile(targetPath, 'utf-8');
  } catch {
    console.error(`Error: Cannot read target file: ${targetPath}`);
    process.exit(1);
  }

  // 3. Extract current params (before)
  const beforeParams = extractSyncedParams(targetContent);

  // 4. Generate SYNCED blocks
  const syncedParams = generateSyncedParams(allOptions);
  const syncedAssignments = generateSyncedAssignments(allOptions);
  const syncedConvertKwargs = generateSyncedConvertKwargs(allOptions);

  // 5. Replace markers in target
  let updatedTarget = targetContent;
  updatedTarget = replaceMarkerBlock(
    updatedTarget,
    '# --- BEGIN SYNCED PARAMS ---',
    '# --- END SYNCED PARAMS ---',
    syncedParams,
  );
  updatedTarget = replaceMarkerBlock(
    updatedTarget,
    '# --- BEGIN SYNCED ASSIGNMENTS ---',
    '# --- END SYNCED ASSIGNMENTS ---',
    syncedAssignments,
  );
  updatedTarget = replaceMarkerBlock(
    updatedTarget,
    '# --- BEGIN SYNCED CONVERT KWARGS ---',
    '# --- END SYNCED CONVERT KWARGS ---',
    syncedConvertKwargs,
  );

  // 6. Detect breaking changes
  const afterParams = new Set(allOptions.map(o => toSnakeCase(o.name)));
  const removed = beforeParams.filter(p => !afterParams.has(p));
  const added = [...afterParams].filter(p => !beforeParams.includes(p));
  const breaking = removed.length > 0;

  // 7. Generate README table (if readme path provided)
  let updatedReadme = null;
  if (readmePath) {
    try {
      const readmeContent = await readFile(readmePath, 'utf-8');
      const tableRows = generateReadmeTableRows(allOptions);
      updatedReadme = replaceMarkerBlock(
        readmeContent,
        '<!-- BEGIN SYNCED PARAMS TABLE -->',
        '<!-- END SYNCED PARAMS TABLE -->',
        tableRows,
      );
    } catch (err) {
      console.warn(`Warning: Cannot update README: ${err.message}`);
    }
  }

  // 8. Generate PR body
  let prBody = null;
  if (prBodyPath || dryRun) {
    prBody = generatePrBody(version, added, removed, breaking, allOptions);
  }

  // 9. Output
  if (dryRun) {
    console.log('=== SYNCED PARAMS ===');
    console.log(syncedParams);
    console.log('\n=== SYNCED ASSIGNMENTS ===');
    console.log(syncedAssignments);
    console.log('\n=== SYNCED CONVERT KWARGS ===');
    console.log(syncedConvertKwargs);
    if (prBody) {
      console.log('\n=== PR BODY ===');
      console.log(prBody);
    }
    console.log(`\nBreaking: ${breaking}`);
    if (removed.length) console.log(`Removed: ${removed.join(', ')}`);
    if (added.length) console.log(`Added: ${added.join(', ')}`);
    console.log('\n[dry-run] No files written.');
  } else {
    await writeFile(targetPath, updatedTarget, 'utf-8');
    console.log(`Written: ${targetPath}`);

    if (updatedReadme && readmePath) {
      await writeFile(readmePath, updatedReadme, 'utf-8');
      console.log(`Written: ${readmePath}`);
    }

    if (prBody && prBodyPath) {
      await writeFile(prBodyPath, prBody, 'utf-8');
      console.log(`Written: ${prBodyPath}`);
    }
  }

  // 10. Exit code for CI
  if (breaking) {
    console.log('\n⚠️  Breaking changes detected!');
  }

  // Output for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_OUTPUT, `breaking=${breaking}\n`);
    await appendFile(process.env.GITHUB_OUTPUT, `changed=${targetContent !== updatedTarget}\n`);
  }
}

function extractSyncedParams(content) {
  const params = [];
  const regex = /self\.(\w+)\s*=/g;
  const beginIdx = content.indexOf('# --- BEGIN SYNCED ASSIGNMENTS ---');
  const endIdx = content.indexOf('# --- END SYNCED ASSIGNMENTS ---');
  if (beginIdx === -1 || endIdx === -1) return params;

  const block = content.substring(beginIdx, endIdx);
  let match;
  while ((match = regex.exec(block)) !== null) {
    params.push(match[1]);
  }
  return params;
}

function generateSyncedParams(options) {
  const lines = [];
  for (const opt of options) {
    const snake = toSnakeCase(opt.name);
    const pyType = TYPE_OVERRIDES[opt.name] || getPythonType(opt);
    const pyDefault = DEFAULT_OVERRIDES[opt.name] || getPythonDefault(opt);
    lines.push(`        ${snake}: ${pyType} = ${pyDefault},`);
  }
  return lines.join('\n');
}

function generateSyncedAssignments(options) {
  const lines = [];
  for (const opt of options) {
    const snake = toSnakeCase(opt.name);
    lines.push(`        self.${snake} = ${snake}`);
  }
  return lines.join('\n');
}

function generateSyncedConvertKwargs(options) {
  const lines = ['            convert_kwargs: dict[str, Any] = {'];
  for (const opt of options) {
    const snake = toSnakeCase(opt.name);
    lines.push(`                "${snake}": self.${snake},`);
  }
  lines.push('            }');
  return lines.join('\n');
}

function generateReadmeTableRows(options) {
  const lines = [];
  for (const opt of options) {
    const snake = toSnakeCase(opt.name);
    const pyType = opt.type === 'boolean' ? '`bool`' : '`str`';
    const pyDefault = opt.default === null ? '`None`'
      : opt.type === 'boolean' ? (opt.default ? '`True`' : '`False`')
      : `\`"${opt.default}"\``;
    const desc = escapeMarkdown(opt.description);
    lines.push(`| \`${snake}\` | ${pyType} | ${pyDefault} | ${desc} |`);
  }
  return lines.join('\n');
}

function generatePrBody(version, added, removed, breaking, allOptions) {
  const lines = [
    `## Sync upstream v${version}`,
    '',
    `Automatically generated from \`options.json\` v${version}.`,
    '',
  ];

  // --- Change summary ---
  if (breaking) {
    lines.push('### ⚠️ Breaking Changes');
    lines.push('');
    lines.push('The following parameters were **removed**:');
    for (const p of removed) {
      lines.push(`- \`${p}\``);
    }
    lines.push('');
  }

  if (added.length) {
    lines.push('### ✨ New Parameters');
    lines.push('');
    for (const p of added) {
      const opt = allOptions.find(o => toSnakeCase(o.name) === p);
      const desc = opt ? ` — ${opt.description}` : '';
      lines.push(`- \`${p}\`${desc}`);
    }
    lines.push('');
  }

  if (!added.length && !removed.length) {
    lines.push('No parameter changes detected (dependency version bump only).');
    lines.push('');
  }

  // --- Auto-generated files ---
  lines.push('### Auto-updated Files');
  lines.push('');
  lines.push('- [x] `document_loaders.py` — SYNCED PARAMS, ASSIGNMENTS, CONVERT KWARGS');
  lines.push('- [x] `README.md` — Parameters Reference table');
  lines.push('- [x] `pyproject.toml` — dependency version bumped');
  lines.push('');

  // --- Review checklist (dynamic) ---
  lines.push('### Review Checklist');
  lines.push('');

  // Always required
  lines.push('**Auto-generated code verification:**');
  lines.push('- [ ] SYNCED PARAMS: types and defaults are correct');
  lines.push('- [ ] SYNCED ASSIGNMENTS: all new params assigned');
  lines.push('- [ ] SYNCED CONVERT KWARGS: all new params passed to extract()');
  lines.push('- [ ] README table: new rows accurate, existing rows unchanged');
  lines.push('');

  // Conditional: new params
  if (added.length) {
    lines.push('**New parameters (manual work needed):**');
    for (const p of added) {
      lines.push(`- [ ] Add test for \`${p}\` (at minimum: mock kwargs pass-through)`);
    }
    lines.push(`- [ ] Docstring Args section updated for: ${added.map(p => `\`${p}\``).join(', ')}`);
    lines.push('');
  }

  // Conditional: breaking
  if (breaking) {
    lines.push('**Breaking changes (manual work needed):**');
    for (const p of removed) {
      lines.push(`- [ ] Remove tests referencing \`${p}\``);
    }
    lines.push('- [ ] CHANGELOG: document breaking change');
    lines.push('- [ ] Bump MAJOR version');
    lines.push('');
  }

  // Conditional: check wrapper logic impact
  if (added.length || removed.length) {
    lines.push('**Wrapper logic impact check:**');
    lines.push('- [ ] `split_sections` logic: does any new param affect section splitting?');
    lines.push('- [ ] Error handling in `lazy_load`: any new failure modes?');
    lines.push('- [ ] Metadata fields: should new param appear in Document metadata?');
    lines.push('');
  }

  // Always required
  lines.push('**Before merge:**');
  lines.push('- [ ] All tests pass: `pytest tests/ -v --disable-socket`');
  lines.push('- [ ] CHANGELOG updated');
  if (added.length && !breaking) {
    lines.push('- [ ] Bump MINOR version');
  }
  if (!added.length && !removed.length) {
    lines.push('- [ ] Bump PATCH version');
  }
  lines.push('');

  lines.push('**After merge:**');
  lines.push('- [ ] Tag push: `git tag vX.Y.Z && git push --tags`');
  lines.push('- [ ] PyPI deployment verified');

  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
