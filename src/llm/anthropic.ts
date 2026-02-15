import { App } from "obsidian";
import { LLMProvider, ChatMessage } from "./interfaces";
import { MyPluginSettings } from "../settings";

export class AnthropicProvider implements LLMProvider {
	id = "anthropic";
	name = "Anthropic";

	constructor(private app: App, private settings: MyPluginSettings) {}

	async listModels(): Promise<string[]> {
		return [
			"claude-opus-4-6",
			"claude-sonnet-4-5",
			"claude-haiku-4-5"
		];
	}

	async *generateStream(messages: ChatMessage[], model: string, temperature: number): AsyncGenerator<string, void, unknown> {
		const apiKey = this.settings.anthropicApiKeyName;
		
		if (!apiKey) {
			throw new Error("Anthropic API key not found in settings.");
		}

		const systemMessage = messages.find(m => m.role === "system");
		const chatMessages = messages.filter(m => m.role !== "system").map(m => {
			if (!m.images || m.images.length === 0) {
				return { role: m.role, content: m.content };
			}

			// Anthropic multi-modal content format
			const contentParts: any[] = [{ type: "text", text: m.content }];
			m.images.forEach(img => {
				contentParts.push({
					type: "image",
					source: {
						type: "base64",
						media_type: img.mimeType,
						data: img.data
					}
				});
			});

			return { role: m.role, content: contentParts };
		});

		const postData = JSON.stringify({
			model: model,
			system: systemMessage?.content,
			messages: chatMessages,
			stream: true,
			max_tokens: 4096,
			temperature: temperature
		});

		// Use Node.js https to bypass CORS on Desktop
		const https = require('https');
		
		const options = {
			hostname: 'api.anthropic.com',
			port: 443,
			path: '/v1/messages',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			}
		};

		const response: any = await new Promise((resolve, reject) => {
			const req = https.request(options, (res: any) => {
				if (res.statusCode < 200 || res.statusCode >= 300) {
					let errorBody = "";
					res.on('data', (d: any) => errorBody += d);
					res.on('end', () => {
						reject(new Error(`Anthropic error: ${res.statusCode} ${errorBody}`));
					});
				} else {
					resolve(res);
				}
			});
			req.on('error', reject);
			req.write(postData);
			req.end();
		});

		let buffer = "";
		for await (const chunk of response) {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() || "";

			for (const line of lines) {
				const trimmedLine = line.trim();
				if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
				
				try {
					const json = JSON.parse(trimmedLine.substring(6));
					if (json.type === "content_block_delta" && json.delta?.text) {
						yield json.delta.text;
					}
				} catch (e) {
					// SSE parsing error
				}
			}
		}
	}
}
