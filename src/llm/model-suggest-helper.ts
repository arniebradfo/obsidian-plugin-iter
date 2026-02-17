import { App, AbstractInputSuggest, TFile } from "obsidian";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";
import { AnthropicProvider } from "./anthropic";
import { AzureOpenAIProvider } from "./azure";
import InlineAIChatNotebookPlugin from "../main";

export async function getAllAvailableModels(app: App, plugin: InlineAIChatNotebookPlugin): Promise<string[]> {
	const allModels: string[] = [];

	const ollama = new OllamaProvider(plugin.settings);
	const openai = new OpenAIProvider(app, plugin.settings);
	const gemini = new GeminiProvider(app, plugin.settings);
	const anthropic = new AnthropicProvider(app, plugin.settings);
	const azure = new AzureOpenAIProvider(app, plugin.settings);

	const results = await Promise.all([
		ollama.listModels().then(ms => ms.map(m => `ollama/${m}`)),
		openai.listModels().then(ms => ms.map(m => `openai/${m}`)),
		gemini.listModels().then(ms => ms.map(m => `gemini/${m}`)),
		anthropic.listModels().then(ms => ms.map(m => `anthropic/${m}`)),
		azure.listModels().then(ms => ms.map(m => `azure/${m}`))
	]);

	results.forEach(ms => allModels.push(...ms));

	// Filter based on configuration
	return allModels.filter(m => {
		const isHidden = plugin.settings.modelConfig[m] === false;
		return !isHidden;
	});
}

export class ModelInputSuggest extends AbstractInputSuggest<string> {
	constructor(app: App, private inputEl: HTMLInputElement, private plugin: InlineAIChatNotebookPlugin) {
		super(app, inputEl);
	}

	async getSuggestions(query: string): Promise<string[]> {
		const allModels = await getAllAvailableModels(this.app, this.plugin);
		return allModels.filter(m => m.toLowerCase().includes(query.toLowerCase()));
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string): void {
		this.inputEl.value = value;
		this.inputEl.trigger("input");
		this.close();
	}
}
