import { App } from "obsidian";
import { LLMProvider, ChatMessage } from "./interfaces";
import { MyPluginSettings } from "../settings";

export class OpenAIProvider implements LLMProvider {
	id = "openai";
	name = "OpenAI";

	constructor(private app: App, private settings: MyPluginSettings) { }

	async listModels(): Promise<string[]> {
		return [
			"gpt-5.2",
			"gpt-5.2-pro",
			// "gpt-5.2-chat-latest",
			// "gpt-5.1",
			// "gpt-5.1-chat-latest",
			// "gpt-5",
			// "gpt-5-pro",
			"gpt-5-mini",
			"gpt-5-nano",
			// "gpt-5-chat-latest",
			// "gpt-4.5-preview",
			// "gpt-4.1",
			// "gpt-4.1-mini",
			// "gpt-4.1-nano",
			// "gpt-4-turbo",
			// "chatgpt-4o-latest",
			// "gpt-4o",
			// "gpt-4o-mini",
			// "gpt-4",
			// "gpt-3.5-turbo",
			"o4-mini",
			"o3",
			"o3-mini",
			"o3-pro",
			// "o1",
			// "o1-pro",
			// "o1-mini",
			// "o1-preview",
		];
	}

			async *generateStream(messages: ChatMessage[], model: string, temperature: number, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {

				const apiKey = this.settings.openAiApiKeyName;

				

				if (!apiKey) {

					throw new Error("OpenAI API key not found in settings. Please configure it in the plugin settings.");

				}

		

				const formattedMessages = messages.map(m => {

					if (!m.images || m.images.length === 0) {

						return { role: m.role, content: m.content };

					}

		

					// OpenAI multi-modal content format

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

		

				const response = await fetch("https://api.openai.com/v1/chat/completions", {

					method: "POST",

					headers: {

						"Content-Type": "application/json",

						"Authorization": `Bearer ${apiKey}`

					},

					body: JSON.stringify({

						model: model,

						messages: formattedMessages,

						stream: true,

						temperature: temperature

					}),
					signal: signal

				});

		
			if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(`OpenAI error: ${response.status} ${errorData.error?.message || response.statusText}`);
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
							console.error("Error parsing OpenAI SSE chunk", e);
						}
					}
				}
			}
		}
	}
}