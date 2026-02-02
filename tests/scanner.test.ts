import { expect, test, describe } from "bun:test";
import { scanFiles } from "../src/scanner";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const TEST_DIR = join(import.meta.dir, "../.test-fixtures");

function setup() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanup() {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

describe("scanner", () => {
  test("detects hardcoded API keys", () => {
    setup();
    const testFile = join(TEST_DIR, "secrets.ts");
    writeFileSync(testFile, `const api_key = "supersecretkey12345678";`);

    const result = scanFiles(TEST_DIR);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(i => i.patternId === "hardcoded-secret")).toBe(true);
    cleanup();
  });

  test("detects SQL injection", () => {
    setup();
    const testFile = join(TEST_DIR, "db.ts");
    writeFileSync(testFile, "db.query(`SELECT * FROM users WHERE id = ${userId}`);");

    const result = scanFiles(TEST_DIR);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(i => i.patternId === "sql-injection-template")).toBe(true);
    cleanup();
  });

  test("detects command injection", () => {
    setup();
    const testFile = join(TEST_DIR, "cmd.ts");
    writeFileSync(testFile, "exec(`rm -rf ${userInput}`);");

    const result = scanFiles(TEST_DIR);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(i => i.patternId === "command-injection")).toBe(true);
    cleanup();
  });

  test("returns empty for clean code", () => {
    setup();
    const testFile = join(TEST_DIR, "clean.ts");
    writeFileSync(testFile, `
const apiKey = process.env.API_KEY;
const query = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
console.log("Hello world");
`);

    const result = scanFiles(TEST_DIR);

    expect(result.issues.length).toBe(0);
    cleanup();
  });

  test("scans multiple files", () => {
    setup();
    writeFileSync(join(TEST_DIR, "file1.ts"), `const api_key = "supersecretkey12345678";`);
    writeFileSync(join(TEST_DIR, "file2.ts"), `exec(\`ls \${dir}\`);`);

    const result = scanFiles(TEST_DIR);

    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    cleanup();
  });
});
