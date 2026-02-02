import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";
import { securityPatterns } from "./patterns";
import type { SecurityIssue, ScanResult } from "./types";

const SUPPORTED_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".mjs", ".cjs"];
const IGNORED_DIRS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".venv",
  "__pycache__",
  "coverage",
  ".turbo",
  "tests",
  "__tests__",
];

/**
 * Recursively collect all files from a directory that match supported extensions.
 * Also handles single file paths.
 */
function collectFiles(dir: string, files: string[] = []): string[] {
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return files;
  }

  // Handle single file path
  if (stat.isFile()) {
    const ext = extname(dir).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext)) {
      files.push(dir);
    }
    return files;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    try {
      const entryStat = statSync(fullPath);

      if (entryStat.isDirectory()) {
        if (!IGNORED_DIRS.includes(entry) && !entry.startsWith(".")) {
          collectFiles(fullPath, files);
        }
      } else if (entryStat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    } catch {
      continue;
    }
  }

  return files;
}

/**
 * Find the line number for a match index in content.
 */
function getLineNumber(content: string, matchIndex: number): number {
  const lines = content.substring(0, matchIndex).split("\n");
  return lines.length;
}

/**
 * Check if .env is properly ignored in .gitignore
 */
function checkGitignore(dir: string): string[] {
  const warnings: string[] = [];
  const gitignorePath = join(dir, ".gitignore");
  const envPath = join(dir, ".env");

  // Only warn if .env exists
  if (!existsSync(envPath)) {
    return warnings;
  }

  if (!existsSync(gitignorePath)) {
    warnings.push(
      ".env file exists but no .gitignore found. Create a .gitignore and add .env to prevent committing secrets."
    );
    return warnings;
  }

  try {
    const gitignoreContent = readFileSync(gitignorePath, "utf-8");
    const lines = gitignoreContent.split("\n").map((l) => l.trim());

    // Check if .env is ignored (simple check)
    const envIgnored = lines.some(
      (line) =>
        line === ".env" ||
        line === ".env*" ||
        line === "*.env" ||
        line === ".env.local" ||
        line.startsWith(".env")
    );

    if (!envIgnored) {
      warnings.push(
        ".env file exists but is not in .gitignore. Add .env to .gitignore to prevent committing secrets."
      );
    }
  } catch {
    // Ignore read errors
  }

  return warnings;
}

/**
 * Scan a single file for security issues.
 */
function scanFile(filePath: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return issues;
  }

  for (const pattern of securityPatterns) {
    // Reset regex lastIndex for global patterns
    pattern.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const matchText = match[0];

      issues.push({
        file: filePath,
        line,
        patternId: pattern.id,
        patternName: pattern.name,
        fixPrompt: pattern.fixPrompt,
        match: matchText.length > 60 ? matchText.substring(0, 60) + "..." : matchText,
        severity: pattern.severity,
      });
    }
  }

  return issues;
}

/**
 * Scan all files in a directory for security issues.
 */
export function scanFiles(dir: string): ScanResult {
  const files = collectFiles(dir);
  const allIssues: SecurityIssue[] = [];
  const warnings = checkGitignore(dir);

  for (const file of files) {
    const issues = scanFile(file);
    allIssues.push(...issues);
  }

  // Sort by severity (critical first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { issues: allIssues, warnings };
}
