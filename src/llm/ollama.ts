import { requestUrl } from "obsidian";
import { LLMProvider, ChatMessage } from "./interfaces";
import { MyPluginSettings } from "../settings";

export class OllamaProvider implements LLMProvider {
	id = "ollama";
	name = "Ollama";

	constructor(private settings: MyPluginSettings) {}

	async listModels(): Promise<string[]> {
		try {
			const response = await fetch(`${this.settings.ollamaUrl}/api/tags`);
			if (!response.ok) return [];
			const data = await response.json();
			return data.models?.map((m: any) => m.name) || [];
		} catch (e) {
			console.error("Failed to list Ollama models", e);
			return [];
		}
	}

	async *generateStream(messages: ChatMessage[], model: string, temperature: number, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
		// Ollama wants images as an array of base64 strings in each message
		const formattedMessages = messages.map(m => ({
			role: m.role,
			content: m.content,
			images: m.images?.map(img => img.data)
		}));

		const response = await fetch(`${this.settings.ollamaUrl}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: model,
				messages: formattedMessages,
				stream: true,
				options: {
					temperature: temperature
				}
			}),
			signal: signal
		});

		if (!response.ok) {
			throw new Error(`Ollama error: ${response.statusText}`);
		}

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();

		if (reader) {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const json = JSON.parse(line);
						if (json.message?.content) {
							yield json.message.content;
						}
					} catch (e) {
						console.error("Error parsing Ollama chunk", e);
					}
				}
			}
		}
	}
}
