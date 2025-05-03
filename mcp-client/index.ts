import { Anthropic } from '@anthropic-ai/sdk';
import type {
    MessageParam,
    Tool,
} from '@anthropic-ai/sdk/resources/messages/messages.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import readline from 'readline/promises';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
}

class MCPClient {
    private mcp: Client;
    private anthropic: Anthropic;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];

    constructor() {
        this.anthropic = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        })
        this.mcp = new Client({
            name: 'mcp-client-cli',
            version: '1.0.0',
        })
    }

    async connectToServer(serverScriptPath: string) {
        try {
            const isJs = serverScriptPath.endsWith('.js');
            const isPy = serverScriptPath.endsWith('.py');
            if (!isJs && !isPy) {
                throw new Error('Server script must be a .js or .py file');
            }

            const command = isPy
                ? process.platform === 'win32'
                    ? 'python'
                    : 'python3'
                : process.execPath;

            this.transport = new StdioClientTransport({
                command,
                args: [serverScriptPath],
            })

            this.mcp.connect(this.transport);

            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.inputSchema
                }
            });

            console.log(
                "Connected to server with tools:",
                this.tools.map(({ name }) => name)
            )
        } catch (error) {
            console.error('Failed to connect to server:', error);
            throw error;
        }
    }

    async chatLoop() {

    }

    async cleanup() {

    }
}



async function main() {
    if (process.argv.length < 3) {
        console.log('Usage: node index.ts <path_to_server_script>');
        return;
    }

    const mcpClient = new MCPClient();
    try {
        await mcpClient.connectToServer(process.argv[2]!);
        await mcpClient.chatLoop();
    } finally {
        await mcpClient.cleanup();
        process.exit(0);
    }
}

main();