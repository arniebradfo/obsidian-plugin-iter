import { InlineAIChatNotebookSettings } from "../settings";
import { App } from "obsidian";
import { LLMProvider } from "./interfaces";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { AnthropicProvider } from "./anthropic";
import { AzureOpenAIProvider } from "./azure";

export function getProvider(app: App, settings: InlineAIChatNotebookSettings, modelString: string): { provider: LLMProvider, actualModel: string } {
	let providerId = 'ollama';
	let actualModel = modelString;

	if (modelString.includes('/')) {
		const parts = modelString.split('/');
		providerId = parts[0] || 'ollama';
		actualModel = parts[1] || modelString;
	}

	switch (providerId) {
		case 'ollama':
			return { provider: new OllamaProvider(settings), actualModel };
		case 'openai':
			return { provider: new OpenAIProvider(app, settings), actualModel };
		case 'gemini':
			return { provider: new GeminiProvider(app, settings), actualModel };
		case 'anthropic':
			return { provider: new AnthropicProvider(app, settings), actualModel };
		case 'azure':
			return { provider: new AzureOpenAIProvider(app, settings), actualModel };
		default:
			throw new Error(`Unknown provider: ${providerId}`);
	}
}
