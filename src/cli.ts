#!/usr/bin/env node
import { scanFiles } from "./scanner";
import {
  formatAgentPrompt,
  generateSummary,
  generateSeveritySummary,
  formatJson,
} from "./prompter";
import { initVibeShield } from "./init";
import { installHook, uninstallHook } from "./hook";

const VERSION = "1.2.3";

// Colors
const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  magenta: "\x1b[35m",
};

function printBanner(): void {
  console.log(
    colors.cyan +
    `
╦  ╦╦╔╗ ╔═╗  ╔═╗╦ ╦╦╔═╗╦  ╔╦╗
╚╗╔╝║╠╩╗║╣   ╚═╗╠═╣║║╣ ║   ║║
 ╚╝ ╩╚═╝╚═╝  ╚═╝╩ ╩╩╚═╝╩═╝═╩╝
` +
    colors.reset
  );
  console.log(colors.dim + `  v${VERSION} - Security scanner for vibe coders\n` + colors.reset);
}

function printHelp(): void {
  printBanner();
  console.log("Usage:");
  console.log(colors.dim + "  vibe-shield [command] [options]\n" + colors.reset);

  console.log("Commands:");
  console.log(
    colors.green + "  scan [path]" + colors.reset + colors.dim + "   Scan for security issues (default: .)" + colors.reset
  );
  console.log(
    colors.green + "  init" + colors.reset + colors.dim + "          Create .cursorrules for AI agent integration" + colors.reset
  );
  console.log(
    colors.green + "  hook" + colors.reset + colors.dim + "          Install pre-commit hook to catch issues" + colors.reset
  );
  console.log(
    colors.green + "  mcp" + colors.reset + colors.dim + "           Start MCP server for Claude/Cursor" + colors.reset
  );
  console.log(colors.green + "  help" + colors.reset + colors.dim + "          Show this help message" + colors.reset);
  console.log(colors.green + "  version" + colors.reset + colors.dim + "       Show version number\n" + colors.reset);

  console.log("Options:");
  console.log(colors.green + "  --json" + colors.reset + colors.dim + "        Output results as JSON" + colors.reset);
  console.log(colors.green + "  --uninstall" + colors.reset + colors.dim + "   Remove pre-commit hook (with hook command)\n" + colors.reset);

  console.log("Examples:");
  console.log(colors.dim + "  npx vibe-shield" + colors.reset);
  console.log(colors.dim + "  npx vibe-shield scan ./src" + colors.reset);
  console.log(colors.dim + "  npx vibe-shield scan . --json" + colors.reset);
  console.log(colors.dim + "  npx vibe-shield hook" + colors.reset);
  console.log(colors.dim + "  npx vibe-shield init\n" + colors.reset);
}

function printVersion(): void {
  console.log(`vibe-shield v${VERSION}`);
}

function runInit(dir: string): void {
  printBanner();
  console.log(colors.yellow + "Initializing vibe-shield...\n" + colors.reset);

  const result = initVibeShield(dir);

  if (result.success) {
    console.log(colors.green + "✓ " + colors.reset + result.message);
    console.log(colors.dim + `  Path: ${result.path}\n` + colors.reset);
    console.log("Your AI agent will now run vibe-shield before completing tasks.");
    console.log(colors.dim + "Happy vibe coding!\n" + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.yellow + "! " + colors.reset + result.message);
    process.exit(0);
  }
}

function runHook(uninstall: boolean): void {
  printBanner();

  if (uninstall) {
    console.log(colors.yellow + "Removing pre-commit hook...\n" + colors.reset);
    const result = uninstallHook(process.cwd());

    if (result.success) {
      console.log(colors.green + "✓ " + colors.reset + result.message);
    } else {
      console.log(colors.yellow + "! " + colors.reset + result.message);
    }
    process.exit(0);
  }

  console.log(colors.yellow + "Installing pre-commit hook...\n" + colors.reset);
  const result = installHook(process.cwd());

  if (result.success) {
    console.log(colors.green + "✓ " + colors.reset + result.message);
    if (result.path) {
      console.log(colors.dim + `  Path: ${result.path}\n` + colors.reset);
    }
    console.log("Security issues will now be caught before each commit.");
    console.log(colors.dim + "To bypass: git commit --no-verify\n" + colors.reset);
    process.exit(0);
  } else {
    console.log(colors.yellow + "! " + colors.reset + result.message);
    process.exit(1);
  }
}

function runScan(dir: string, jsonOutput: boolean): void {
  if (!jsonOutput) {
    printBanner();
    console.log(colors.yellow + `Scanning ${dir}...\n` + colors.reset);
  }

  const { issues, warnings } = scanFiles(dir);

  // JSON output mode
  if (jsonOutput) {
    console.log(formatJson(issues, warnings));
    process.exit(issues.length > 0 ? 1 : 0);
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log(colors.yellow + "Warnings:" + colors.reset);
    for (const warning of warnings) {
      console.log(colors.yellow + "  ⚠ " + colors.reset + warning);
    }
    console.log("");
  }

  if (issues.length === 0) {
    console.log(colors.green + colors.bold + "✓ SAFE" + colors.reset);
    console.log(colors.dim + "No security issues detected. Ship it!\n" + colors.reset);
    process.exit(0);
  }

  // Print severity summary
  const severitySummary = generateSeveritySummary(issues);
  console.log(
    colors.red + colors.bold + `✗ Found ${issues.length} security issue${issues.length > 1 ? "s" : ""}\n` + colors.reset
  );

  console.log("By severity:");
  if (severitySummary.critical > 0) {
    console.log(colors.red + `  • Critical: ${severitySummary.critical}` + colors.reset);
  }
  if (severitySummary.high > 0) {
    console.log(colors.yellow + `  • High: ${severitySummary.high}` + colors.reset);
  }
  if (severitySummary.medium > 0) {
    console.log(colors.cyan + `  • Medium: ${severitySummary.medium}` + colors.reset);
  }
  if (severitySummary.low > 0) {
    console.log(colors.dim + `  • Low: ${severitySummary.low}` + colors.reset);
  }
  console.log("");

  // Print type summary
  const summary = generateSummary(issues);
  console.log("By type:");
  for (const [pattern, count] of Object.entries(summary)) {
    console.log(colors.dim + `  • ${pattern}: ${count}` + colors.reset);
  }
  console.log("");

  // Print agent protocol
  const agentPrompt = formatAgentPrompt(issues);
  console.log(colors.yellow + agentPrompt + colors.reset);
  console.log("");

  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
const jsonFlag = args.includes("--json");
const filteredArgs = args.filter((arg) => !arg.startsWith("--"));

const command = filteredArgs[0] || "scan";
const targetDir = filteredArgs[1] || process.cwd();

switch (command) {
  case "init":
    runInit(targetDir === process.cwd() ? process.cwd() : targetDir);
    break;
  case "scan":
    runScan(targetDir, jsonFlag);
    break;
  case "hook":
    runHook(args.includes("--uninstall"));
    break;
  case "mcp":
    // MCP server communicates via stdio - no console output allowed
    import("./mcp-server").catch((err) => {
      process.stderr.write(`MCP server error: ${err}\n`);
      process.exit(1);
    });
    break;
  case "help":
  case "--help":
  case "-h":
    printHelp();
    process.exit(0);
    break;
  case "version":
  case "--version":
  case "-v":
    printVersion();
    process.exit(0);
    break;
  default:
    // If first arg is a path, treat as scan target
    if (command.startsWith(".") || command.startsWith("/")) {
      runScan(command, jsonFlag);
    } else {
      console.log(colors.red + `Unknown command: ${command}` + colors.reset);
      console.log(colors.dim + 'Run "vibe-shield help" for usage.\n' + colors.reset);
      process.exit(1);
    }
}
