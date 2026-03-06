import { resolve, normalize } from 'node:path';

/**
 * Validates that a file path does not contain directory traversal sequences.
 * Resolves the path to an absolute form and checks that it does not escape
 * the working directory (or an optional allowedRoot).
 *
 * Throws if the path is unsafe.
 */
export function assertSafePath(filePath: string, allowedRoot?: string): string {
  const root = allowedRoot ?? process.cwd();
  const resolved = resolve(root, normalize(filePath));

  if (!resolved.startsWith(root)) {
    throw new Error(`Path traversal detected: resolved path escapes allowed root`);
  }

  return resolved;
}

/**
 * Returns true if the input looks like an HTTP(S) or file:// URL.
 */
export function isHttpLike(input: string): boolean {
  return /^https?:\/\//i.test(input) || input.startsWith('file://');
}

/**
 * Validates a urlOrPath value used in import commands.
 * - If it looks like an HTTP URL, returns it as-is.
 * - If it is a local file path, validates against directory traversal.
 */
export function validateSourcePath(urlOrPath: string): string {
  if (isHttpLike(urlOrPath)) return urlOrPath;
  // For local file paths, ensure no traversal beyond cwd
  return assertSafePath(urlOrPath);
}
