import { App } from "obsidian";
import { LLMProvider, ChatMessage } from "./interfaces";
import { MyPluginSettings } from "../settings";

export class AzureOpenAIProvider implements LLMProvider {
	id = "azure";
	name = "Azure OpenAI";

	constructor(private app: App, private settings: MyPluginSettings) {}

	async listModels(): Promise<string[]> {
		const models = this.settings.azureOpenAiModels.split(",").map(m => m.trim()).filter(m => m);
		return models;
	}

	async *generateStream(messages: ChatMessage[], model: string, temperature: number, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
		const apiKey = this.settings.azureOpenAiKeyName;
		const endpoint = this.settings.azureOpenAiEndpoint.replace(/\/$/, "");
		const apiVersion = "2024-02-01";

		if (!apiKey || !endpoint) {
			throw new Error("Azure OpenAI API key or endpoint not found in settings.");
		}

		const formattedMessages = messages.map(m => {
			if (!m.images || m.images.length === 0) {
				return { role: m.role, content: m.content };
			}

			const contentParts: any[] = [{ type: "text", text: m.content }];
			m.images.forEach(img => {
				contentParts.push({
					type: "image_url",
					image_url: {
						url: `data:${img.mimeType};base64,${img.data}`
					}
				});
			});

			return { role: m.role, content: contentParts };
		});

		const url = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"api-key": apiKey
			},
			body: JSON.stringify({
				messages: formattedMessages,
				stream: true,
				temperature: temperature
			}),
			signal: signal
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(`Azure error: ${response.status} ${errorData.error?.message || response.statusText}`);
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
							console.error("Error parsing Azure SSE chunk", e);
						}
					}
				}
			}
		}
	}
}
