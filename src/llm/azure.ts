import { App } from "obsidian";
import { LLMProvider, ChatMessage } from "./interfaces";
import { MyPluginSettings } from "../settings";

export class AzureOpenAIProvider implements LLMProvider {
	id = "azure";
	name = "Azure OpenAI";

	constructor(private app: App, private settings: MyPluginSettings) {}

	async listModels(): Promise<string[]> {
		if (!this.settings.azureOpenAiModels) return [];
		return this.settings.azureOpenAiModels
			.split(',')
			.map(m => m.trim())
			.filter(m => m.length > 0);
	}

	async *generateStream(messages: ChatMessage[], model: string): AsyncGenerator<string, void, unknown> {
		const apiKey = this.settings.azureOpenAiKeyName;
		const endpoint = this.settings.azureOpenAiEndpoint;
		
		if (!apiKey || !endpoint) {
			throw new Error("Azure OpenAI Key or Endpoint not found in settings.");
		}

		const baseUrl = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
		const url = `${baseUrl}openai/deployments/${model}/chat/completions?api-version=2024-02-01`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": apiKey
			},
			body: JSON.stringify({
				messages: messages,
				stream: true
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(`Azure OpenAI error: ${response.status} ${errorData.error?.message || response.statusText}`);
		}

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (reader) {
			let buffer = "";
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					const trimmedLine = line.trim();
					if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
					
					if (trimmedLine.startsWith("data: ")) {
						try {
							const json = JSON.parse(trimmedLine.substring(6));
							const content = json.choices?.[0]?.delta?.content;
							if (content) {
								yield content;
							}
						} catch (e) {
							// SSE parsing error
						}
					}
				}
			}
		}
	}
}