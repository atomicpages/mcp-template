#!/usr/bin/env bun

declare function prompt(message?: string): string | null;

/**
 * Template rename script.
 *
 * Replaces the four placeholder tokens in every file under the current
 * directory (skipping node_modules, .git, dist, *.lock, binary files), then
 * renames paths whose names contain the kebab token. After a successful run
 * (no --dry-run), self-deletes.
 *
 * Usage:
 *   bun setup.ts \
 *     --kebab my-service \
 *     --pascal MyService \
 *     --upper MY_SERVICE \
 *     --title "My Service" \
 *     --openapi-url https://api.example.com/openapi.json
 *
 *   # or interactive (prompts for any missing flag):
 *   bun setup.ts
 *
 *   # preview without writing:
 *   bun setup.ts --kebab my-service --pascal MyService \
 *     --upper MY_SERVICE --title "My Service" --dry-run
 *
 * The --openapi-url flag is optional. When provided it replaces
 * {{ API_OPENAPI_PATH }} in openapi-ts.config.ts with the given URL.
 * When omitted, a reminder is printed after setup completes.
 */

import {
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

type Tokens = {
  kebab: string;
  pascal: string;
  upper: string;
  title: string;
};

const TOKEN_KEYS = ["kebab", "pascal", "upper", "title"] as const;

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".cache",
  "out",
  "coverage",
]);

// Files that should NOT be token-replaced (template's own docs, not project docs)
const SKIP_FILES = new Set(["README.md"]);

// File that becomes the project README after token replacement
const PROJECT_README = "PROJECT_README.md";

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tgz",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

function parseArgs(argv: string[]): {
  partial: Partial<Tokens>;
  dryRun: boolean;
  openapiUrl?: string;
} {
  const partial: Partial<Tokens> = {};
  let dryRun = false;
  let openapiUrl: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--openapi-url" || arg === "--openapi") {
      const value = argv[i + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }

      openapiUrl = value;
      i++;

      continue;
    }
    if (
      arg === "--kebab" ||
      arg === "--pascal" ||
      arg === "--upper" ||
      arg === "--title"
    ) {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      partial[arg.slice(2) as keyof Tokens] = value;
      i++;
    }
  }

  return { partial, dryRun, openapiUrl };
}

function promptMissing(partial: Partial<Tokens>): Tokens {
  const tokens = { ...partial } as Partial<Tokens>;
  const examples: Record<keyof Tokens, string> = {
    kebab: "my-service (lowercase, hyphens)",
    pascal: "MyService (camelCase / PascalCase for symbols)",
    upper: "MY_SERVICE (uppercase env var prefix)",
    title: "My Service (free-form display name)",
  };

  for (const key of TOKEN_KEYS) {
    if (!tokens[key]) {
      const value = prompt(`Enter ${key} (${examples[key]}):`);
      if (!value) {
        console.error(`Missing required value for ${key}`);
        process.exit(1);
      }
      tokens[key] = value.trim();
    }
  }

  return tokens as Tokens;
}

function validateTokens(t: Tokens): void {
  if (!/^[a-z][a-z0-9-]*$/.test(t.kebab)) {
    throw new Error(
      `--kebab must be lowercase letters/digits/hyphens, got "${t.kebab}"`,
    );
  }
  if (!/^[A-Z][A-Za-z0-9]*$/.test(t.pascal)) {
    throw new Error(`--pascal must be PascalCase, got "${t.pascal}"`);
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(t.upper)) {
    throw new Error(`--upper must be UPPER_SNAKE_CASE, got "${t.upper}"`);
  }
  if (t.title.length === 0) {
    throw new Error("--title must not be empty");
  }
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name);
}

function isBinary(path: string): boolean {
  const dotIdx = path.lastIndexOf(".");
  if (dotIdx === -1) {
    return false;
  }
  return BINARY_EXT.has(path.slice(dotIdx).toLowerCase());
}

function walkFiles(root: string): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      if (shouldSkipDir(entry)) {
        continue;
      }
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        out.push(full);
      }
    }
  }

  walk(root);
  return out;
}

function walkDirsBottomUp(root: string): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      if (shouldSkipDir(entry)) {
        continue;
      }
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        out.push(full);
      }
    }
  }

  walk(root);
  return out;
}

function replaceTokens(
  content: string,
  t: Tokens,
  openapiUrl?: string,
): string {
  let result = content
    .replaceAll("__SERVICE_KEBAB__", t.kebab)
    .replaceAll("__SERVICE_PASCAL__", t.pascal)
    .replaceAll("__SERVICE_UPPER__", t.upper)
    .replaceAll("__SERVICE_TITLE__", t.title);

  if (openapiUrl) {
    result = result.replaceAll("{{ API_OPENAPI_PATH }}", openapiUrl);
  }

  return result;
}

function pathHasToken(p: string): boolean {
  return p.includes("__SERVICE_KEBAB__");
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let partial: Partial<Tokens> = {};
  let dryRun = false;
  let openapiUrl: string | undefined;

  try {
    ({ partial, dryRun, openapiUrl } = parseArgs(argv));
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }

  const tokens = promptMissing(partial);

  try {
    validateTokens(tokens);
  } catch (err) {
    console.error(String(err));
    process.exit(1);
  }

  const root = process.cwd();
  const selfPath = join(root, "setup.ts");

  console.error(
    `[setup] kebab=${tokens.kebab}  pascal=${tokens.pascal}  upper=${tokens.upper}  title="${tokens.title}"  dryRun=${dryRun}${openapiUrl ? `  openapiUrl=${openapiUrl}` : ""}`,
  );

  const files = walkFiles(root).filter(
    (f) => f !== selfPath && !SKIP_FILES.has(relative(root, f)),
  );

  let contentChanges = 0;
  for (const file of files) {
    if (isBinary(file)) {
      continue;
    }

    let original: string;
    try {
      original = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const updated = replaceTokens(original, tokens, openapiUrl);
    if (updated !== original) {
      contentChanges++;
      if (!dryRun) {
        writeFileSync(file, updated);
      } else {
        console.error(`[content] ${relative(root, file)}`);
      }
    }
  }

  // Rename files first, then bottom-up dirs.
  let pathChanges = 0;
  const renamableFiles = walkFiles(root).filter(
    (f) => f !== selfPath && pathHasToken(f),
  );
  for (const file of renamableFiles) {
    const target = replaceTokens(file, tokens);
    pathChanges++;
    if (dryRun) {
      console.error(
        `[rename] ${relative(root, file)} -> ${relative(root, target)}`,
      );
    } else {
      renameSync(file, target);
    }
  }

  const renamableDirs = walkDirsBottomUp(root).filter((d) => pathHasToken(d));
  for (const dir of renamableDirs) {
    const target = replaceTokens(dir, tokens);
    pathChanges++;
    if (dryRun) {
      console.error(
        `[rename] ${relative(root, dir)} -> ${relative(root, target)}`,
      );
    } else {
      renameSync(dir, target);
    }
  }

  // Replace PROJECT_README.md → README.md (token-replaced)
  const projectReadmePath = join(root, PROJECT_README);
  try {
    const projectReadmeContent = readFileSync(projectReadmePath, "utf8");
    const replacedReadme = replaceTokens(
      projectReadmeContent,
      tokens,
      openapiUrl,
    );
    if (!dryRun) {
      writeFileSync(join(root, "README.md"), replacedReadme);
      unlinkSync(projectReadmePath);
    } else {
      console.error("[readme] PROJECT_README.md -> README.md (token-replaced)");
    }
  } catch {
    console.error("[setup] PROJECT_README.md not found — skipping README swap");
  }

  console.error(
    `[setup] ${dryRun ? "would update" : "updated"} ${contentChanges} files; ${dryRun ? "would rename" : "renamed"} ${pathChanges} paths`,
  );

  if (!dryRun) {
    try {
      unlinkSync(selfPath);
      console.error("[setup] removed setup.ts");
    } catch (err) {
      console.error(`[setup] could not remove setup.ts: ${String(err)}`);
    }

    console.error("[setup] done. Next steps:");
    console.error("        bun install");
    if (!openapiUrl) {
      console.error(
        "        # Update openapi-ts.config.ts `input` with your OpenAPI spec URL, then:",
      );
    }
    console.error("        bun run codegen");
    console.error("        bun run lint");
    console.error("        bun run typecheck");
    console.error("        bun run build");
  }
}

await main();
