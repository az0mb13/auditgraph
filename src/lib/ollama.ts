export class OllamaService {
    private baseUrl: string;
    private model: string;

    constructor(baseUrl = 'http://127.0.0.1:11434', model = 'codellama') {
        this.baseUrl = baseUrl;
        this.model = model;
    }

    async generateSecuritySummary(code: string): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const prompt = `
You are a smart contract security auditor. Analyze the following Solidity code for vulnerabilities, bugs, and gas optimization issues.
Provide a concise markdown summary.

Code:
\`\`\`solidity
${code}
\`\`\`

Analysis:
`;
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: true // We want streaming
                }),
            });

            if (!response.ok) {
                console.error('Ollama API error:', response.statusText);
                return null;
            }

            return response.body;

        } catch (error) {
            console.error('Ollama Service Error:', error);
            return null;
        }
    }
}

export const ollamaService = new OllamaService();
