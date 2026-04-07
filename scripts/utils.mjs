// Shared utilities for code generation scripts
// Extracted from opendataloader-pdf/scripts/utils.mjs (generic parts only)

/**
 * Convert kebab-case to snake_case (Python).
 * @param {string} name - kebab-case name
 * @returns {string} snake_case name
 */
export function toSnakeCase(name) {
  return name.replace(/-/g, '_');
}

/**
 * Convert kebab-case to camelCase (JavaScript).
 * @param {string} name - kebab-case name
 * @returns {string} camelCase name
 */
export function toCamelCase(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Escape special characters for Markdown table cells.
 * @param {string} text
 * @returns {string}
 */
export function escapeMarkdown(text) {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Format a Markdown table from headers and rows.
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
export function formatTable(headers, rows) {
  const headerLine = `| ${headers.join(' | ')} |`;
  const separatorLine = `|${headers.map(() => '---').join('|')}|`;
  const dataLines = rows.map(row => `| ${row.join(' | ')} |`);
  return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Replace content between markers in a file.
 * @param {string} content - File content
 * @param {string} beginMarker - Begin marker string
 * @param {string} endMarker - End marker string
 * @param {string} replacement - New content between markers
 * @returns {string} Updated content
 */
export function replaceMarkerBlock(content, beginMarker, endMarker, replacement) {
  const beginIdx = content.indexOf(beginMarker);
  const endIdx = content.indexOf(endMarker);

  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(`Markers not found: ${beginMarker} / ${endMarker}`);
  }

  // Preserve the indentation of the end marker line
  const lineStart = content.lastIndexOf('\n', endIdx) + 1;
  const indent = content.substring(lineStart, endIdx).match(/^(\s*)/)?.[1] || '';

  const before = content.substring(0, beginIdx + beginMarker.length);
  const after = `${indent}${endMarker}${content.substring(endIdx + endMarker.length)}`;

  return `${before}\n${replacement}\n${after}`;
}

/**
 * Read and parse options.json.
 * @param {string} filePath
 * @returns {object}
 */
export async function readOptions(filePath) {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/** List of options that accept comma-separated multiple values. */
export const LIST_OPTIONS = new Set(['format', 'heading-level', 'sections']);

/**
 * Determine Python type hint for an option.
 * @param {object} opt - Option from options.json
 * @returns {string} Python type hint
 */
export function getPythonType(opt) {
  if (LIST_OPTIONS.has(opt.name)) {
    return 'Optional[Union[str, List[str]]]';
  }
  if (opt.type === 'boolean') {
    return 'bool';
  }
  if (opt.default === null) {
    return 'Optional[str]';
  }
  return 'str';
}

/**
 * Get Python default value representation.
 * @param {object} opt
 * @returns {string}
 */
export function getPythonDefault(opt) {
  if (opt.default === null) return 'None';
  if (opt.type === 'boolean') return opt.default ? 'True' : 'False';
  return `"${opt.default}"`;
}
