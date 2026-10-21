/**
 * Minimal, dependency-free YAML front-matter reader/writer.
 *
 * Only the subset used by the team worklog is supported on purpose:
 *   key: 'string'
 *   key: null
 *   key: [a, b, c]
 *
 * Anything more complex is rejected so that logs stay boring and uniform.
 */

const FRONT_MATTER_START = '---\n';

function unquote(raw) {
  let value = raw.trim();

  if (value === '' || value === 'null' || value === '~') return null;

  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replaceAll("''", "'");
  }

  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  return value;
}

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => unquote(item));
  }
  return unquote(value);
}

/**
 * @param {string} text
 * @returns {{ meta: Record<string, any>, body: string, hasFrontMatter: boolean }}
 */
export function parseFrontMatter(text) {
  const source = String(text).replaceAll('\r\n', '\n');

  if (!source.startsWith(FRONT_MATTER_START)) {
    return { meta: {}, body: source, hasFrontMatter: false };
  }

  const end = source.indexOf('\n---\n', FRONT_MATTER_START.length - 1);
  if (end === -1) {
    return { meta: {}, body: source, hasFrontMatter: false };
  }

  const rawBlock = source.slice(FRONT_MATTER_START.length, end);
  const meta = {};

  for (const line of rawBlock.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) {
      throw new Error(`Unsupported front-matter line: ${line}`);
    }
    meta[match[1]] = parseValue(match[2]);
  }

  return {
    meta,
    body: source.slice(end + '\n---\n'.length),
    hasFrontMatter: true,
  };
}

export function quoteYaml(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Serialize a metadata object with a stable, human-friendly key order.
 * Unknown keys are appended alphabetically.
 *
 * @param {Record<string, any>} meta
 * @param {string[]} keyOrder
 */
export function serializeFrontMatter(meta, keyOrder = []) {
  const keys = [
    ...keyOrder.filter((key) => key in meta),
    ...Object.keys(meta)
      .filter((key) => !keyOrder.includes(key))
      .sort(),
  ];

  const lines = keys.map((key) => {
    const value = meta[key];
    if (Array.isArray(value)) {
      return `${key}: [${value.map((item) => quoteYaml(item)).join(', ')}]`;
    }
    return `${key}: ${value === null || value === undefined ? 'null' : quoteYaml(value)}`;
  });

  return `---\n${lines.join('\n')}\n---\n`;
}
