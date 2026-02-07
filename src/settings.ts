import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	ollamaUrl: string;
	defaultModel: string;
	systemPrompt: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	ollamaUrl: 'http://localhost:11434',
	defaultModel: 'llama3',
	systemPrompt: 'You are a helpful assistant.'
}

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Iter LLM Settings' });

		new Setting(containerEl)
			.setName('Ollama URL')
			.setDesc('The URL where your Ollama instance is running.')
			.addText(text => text
				.setPlaceholder('http://localhost:11434')
				.setValue(this.plugin.settings.ollamaUrl)
				.onChange(async (value) => {
					this.plugin.settings.ollamaUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Model')
			.setDesc('The model name to use (e.g., llama3, mistral).')
			.addText(text => text
				.setPlaceholder('llama3')
				.setValue(this.plugin.settings.defaultModel)
				.onChange(async (value) => {
					this.plugin.settings.defaultModel = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default System Prompt')
			.setDesc('The default system prompt for new chat files.')
			.addTextArea(text => text
				.setPlaceholder('You are a helpful assistant.')
				.setValue(this.plugin.settings.systemPrompt)
				.onChange(async (value) => {
					this.plugin.settings.systemPrompt = value;
					await this.plugin.saveSettings();
				}));
	}
}