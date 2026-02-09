import { App } from "obsidian";
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
