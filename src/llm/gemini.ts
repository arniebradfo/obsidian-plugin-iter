import { App } from "obsidian";
import { LLMProvider, ChatMessage } from "./interfaces";
import { InlineAIChatNotebookSettings } from "../settings";

export class GeminiProvider implements LLMProvider {
	id = "gemini";
	name = "Gemini";

	constructor(private app: App, private settings: InlineAIChatNotebookSettings) {}

	async listModels(): Promise<string[]> {
		return [
			"gemini-3-pro-preview",
			"gemini-3-flash-preview",
			// "gemini-2.5-pro",
			// "gemini-2.5-flash",
			// "gemini-2.5-flash-image",
			// "gemini-2.5-flash-lite",
			// "gemini-2.0-flash",
			// "gemini-2.0-flash-lite",
			// "gemini-flash-latest"
		];
	}

	async *generateStream(messages: ChatMessage[], model: string, temperature: number, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
		const apiKey = this.settings.geminiApiKeyName;
		
		if (!apiKey) {
			throw new Error("Gemini API key not found in settings.");
		}

		// Gemini format
		const contents = messages.map(m => {
			const role = m.role === "assistant" ? "model" : "user";
			const parts: any[] = [{ text: m.content }];
			
			if (m.images) {
				m.images.forEach(img => {
					parts.push({
						inline_data: {
							mime_type: img.mimeType,
							data: img.data
						}
					});
				});
			}

			return { role, parts };
		});

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				contents: contents,
				generationConfig: {
					temperature: temperature
				}
			}),
			signal: signal
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(`Gemini error: ${response.status} ${errorData.error?.message || response.statusText}`);
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
					if (!trimmedLine) continue;

					if (trimmedLine.startsWith("data: ")) {
						try {
							const json = JSON.parse(trimmedLine.substring(6));
							const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
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
