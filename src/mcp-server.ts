#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { scanFiles } from "./scanner";
import { generateSummary, generateSeveritySummary } from "./prompter";

const server = new Server(
    {
        name: "vibe-shield",
        version: "1.2.3",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "vibe_shield_scan",
                description:
                    "Scan a directory or file for security vulnerabilities. Detects hardcoded secrets, SQL injection, command injection, XSS, and more.",
                inputSchema: {
                    type: "object" as const,
                    properties: {
                        path: {
                            type: "string",
                            description:
                                "Path to scan (directory or file). Defaults to current directory.",
                        },
                    },
                    required: [],
                },
            },
        ],
    };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "vibe_shield_scan") {
        const args = request.params.arguments as { path?: string } | undefined;
        const targetPath = args?.path || process.cwd();

        try {
            const { issues, warnings } = scanFiles(targetPath);

            const result = {
                summary: {
                    total: issues.length,
                    bySeverity: generateSeveritySummary(issues),
                    byType: generateSummary(issues),
                },
                issues: issues.map((issue) => ({
                    severity: issue.severity,
                    type: issue.patternName,
                    file: issue.file,
                    line: issue.line,
                    match: issue.match,
                    fix: issue.fixPrompt,
                })),
                warnings,
            };

            if (issues.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "✓ SAFE - No security issues detected.",
                        },
                    ],
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error scanning: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }

    return {
        content: [
            {
                type: "text",
                text: `Unknown tool: ${request.params.name}`,
            },
        ],
        isError: true,
    };
});

// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
