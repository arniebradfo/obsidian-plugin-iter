import { App, AbstractInputSuggest } from "obsidian";
import MyPlugin from "../main";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

export async function getAllAvailableModels(app: App, plugin: MyPlugin): Promise<string[]> {
	const providers = [
		new OllamaProvider(plugin.settings),
		new OpenAIProvider(app, plugin.settings),
		new GeminiProvider(app, plugin.settings)
	];

	const allModels: string[] = [];
	
	for (const provider of providers) {
		try {
			const models = await provider.listModels();
			models.forEach(m => allModels.push(`${provider.id}/${m}`));
		} catch (e) {
			console.error(`Failed to list models for ${provider.id}`, e);
		}
	}
	return allModels;
}

export class ModelInputSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, private input: HTMLInputElement, private plugin: MyPlugin) {
		super(app, input);
	}

	async getSuggestions(query: string): Promise<string[]> {
		const allModels = await getAllAvailableModels(this.app, this.plugin);
		return allModels.filter(m => m.toLowerCase().contains(query.toLowerCase()));
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.input.value = value;
		this.input.dispatchEvent(new Event('input'));
		this.close();
	}
}
