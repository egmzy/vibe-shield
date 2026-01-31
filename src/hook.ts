import { existsSync, mkdirSync, writeFileSync, unlinkSync, chmodSync, readFileSync } from "fs";
import { join } from "path";

const HOOK_MARKER = "# vibe-shield pre-commit hook";

const HOOK_SCRIPT = `#!/bin/sh
${HOOK_MARKER}
# Scans staged files for security issues before commit

# Get list of staged files (added, copied, modified, renamed)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\\.(js|ts|jsx|tsx|py|mjs|cjs)$' || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Run vibe-shield on staged files
echo "🛡️  Running vibe-shield security scan..."

# Create temp file with staged file list
TEMP_FILE=$(mktemp)
echo "$STAGED_FILES" > "$TEMP_FILE"

# Scan each file
FAILED=0
while IFS= read -r file; do
  if [ -f "$file" ]; then
    npx vibe-shield scan "$file" --json > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      FAILED=1
    fi
  fi
done < "$TEMP_FILE"

rm -f "$TEMP_FILE"

if [ $FAILED -ne 0 ]; then
  echo ""
  echo "❌ Security issues found! Run 'npx vibe-shield' for details."
  echo "   To bypass: git commit --no-verify"
  exit 1
fi

echo "✓ No security issues found."
exit 0
`;

export interface HookResult {
    success: boolean;
    message: string;
    path?: string;
}

function findGitDir(startDir: string): string | null {
    let dir = startDir;
    const root = "/";

    while (dir !== root) {
        const gitDir = join(dir, ".git");
        if (existsSync(gitDir)) {
            return gitDir;
        }
        dir = join(dir, "..");
    }

    return null;
}

export function installHook(dir: string): HookResult {
    const gitDir = findGitDir(dir);

    if (!gitDir) {
        return {
            success: false,
            message: "Not a git repository. Run 'git init' first.",
        };
    }

    const hooksDir = join(gitDir, "hooks");
    const hookPath = join(hooksDir, "pre-commit");

    // Check if hook already exists
    if (existsSync(hookPath)) {
        try {
            const content = readFileSync(hookPath, "utf-8");
            if (content.includes(HOOK_MARKER)) {
                return {
                    success: false,
                    message: "vibe-shield hook is already installed.",
                    path: hookPath,
                };
            }
            // Different hook exists
            return {
                success: false,
                message:
                    "A pre-commit hook already exists. Remove it first or add vibe-shield manually.",
                path: hookPath,
            };
        } catch {
            // Continue with installation
        }
    }

    // Create hooks directory if needed
    if (!existsSync(hooksDir)) {
        mkdirSync(hooksDir, { recursive: true });
    }

    // Write hook
    try {
        writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
        chmodSync(hookPath, 0o755);
    } catch (error) {
        return {
            success: false,
            message: `Failed to create hook: ${error instanceof Error ? error.message : String(error)}`,
        };
    }

    return {
        success: true,
        message: "Pre-commit hook installed successfully.",
        path: hookPath,
    };
}

export function uninstallHook(dir: string): HookResult {
    const gitDir = findGitDir(dir);

    if (!gitDir) {
        return {
            success: false,
            message: "Not a git repository.",
        };
    }

    const hookPath = join(gitDir, "hooks", "pre-commit");

    if (!existsSync(hookPath)) {
        return {
            success: false,
            message: "No pre-commit hook found.",
        };
    }

    // Check if it's our hook
    try {
        const content = readFileSync(hookPath, "utf-8");
        if (!content.includes(HOOK_MARKER)) {
            return {
                success: false,
                message: "The current pre-commit hook was not installed by vibe-shield.",
                path: hookPath,
            };
        }
    } catch {
        return {
            success: false,
            message: "Could not read pre-commit hook.",
        };
    }

    // Remove hook
    try {
        unlinkSync(hookPath);
    } catch (error) {
        return {
            success: false,
            message: `Failed to remove hook: ${error instanceof Error ? error.message : String(error)}`,
        };
    }

    return {
        success: true,
        message: "Pre-commit hook removed.",
        path: hookPath,
    };
}
