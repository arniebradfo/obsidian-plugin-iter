import { App, PluginSettingTab, Setting, SettingGroup, SecretComponent } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	// General
	systemPrompt: string;
	defaultModel: string;

	// Providers (these store the NAMES of the secrets in SecretStorage)
	ollamaUrl: string;
	openAiApiKeyName: string;
	anthropicApiKeyName: string;
	geminiApiKeyName: string;
	azureOpenAiKeyName: string;
	azureOpenAiEndpoint: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	systemPrompt: 'You are a helpful assistant.',
	defaultModel: 'llama3',
	ollamaUrl: 'http://localhost:11434',
	openAiApiKeyName: '',
	anthropicApiKeyName: '',
	geminiApiKeyName: '',
	azureOpenAiKeyName: '',
	azureOpenAiEndpoint: ''
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

		// --- General Group ---
		new SettingGroup(containerEl)
			.setHeading('General Settings')
			.addSetting((setting: Setting) => {
				setting.setName('Default System Prompt')
					.setDesc('The default system prompt for new chat files.')
					.addTextArea(text => text
						.setPlaceholder('You are a helpful assistant.')
						.setValue(this.plugin.settings.systemPrompt)
						.onChange(async (value) => {
							this.plugin.settings.systemPrompt = value;
							await this.plugin.saveSettings();
						}));
			})
			.addSetting((setting: Setting) => {
				setting.setName('Default Model Name')
					.setDesc('The fallback model identifier (e.g. llama3, gpt-4o, claude-3-5-sonnet-20240620).')
					.addText(text => text
						.setPlaceholder('llama3')
						.setValue(this.plugin.settings.defaultModel)
						.onChange(async (value) => {
							this.plugin.settings.defaultModel = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Ollama Group ---
		new SettingGroup(containerEl)
			.setHeading('Ollama (Local)')
			.addSetting((setting: Setting) => {
				setting.setName('Ollama URL')
					.setDesc('URL for your local Ollama instance.')
					.addText(text => text
						.setPlaceholder('http://localhost:11434')
						.setValue(this.plugin.settings.ollamaUrl)
						.onChange(async (value) => {
							this.plugin.settings.ollamaUrl = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- OpenAI Group ---
		new SettingGroup(containerEl)
			.setHeading('OpenAI')
			.addSetting((setting: Setting) => {
				setting.setName('OpenAI API Key')
					.setDesc('Select OpenAI API key from SecretStorage')
					.addComponent(el => new SecretComponent(this.app, el)
						.setValue(this.plugin.settings.openAiApiKeyName)
						.onChange(async (value) => {
							this.plugin.settings.openAiApiKeyName = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Anthropic Group ---
		new SettingGroup(containerEl)
			.setHeading('Anthropic')
			.addSetting((setting: Setting) => {
				setting.setName('Anthropic API Key')
					.setDesc('Select Anthropic API key from SecretStorage')
					.addComponent(el => new SecretComponent(this.app, el)
						.setValue(this.plugin.settings.anthropicApiKeyName)
						.onChange(async (value) => {
							this.plugin.settings.anthropicApiKeyName = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Google Gemini Group ---
		new SettingGroup(containerEl)
			.setHeading('Google Gemini')
			.addSetting((setting: Setting) => {
				setting.setName('Gemini API Key')
					.setDesc('Select Gemini API key from SecretStorage')
					.addComponent(el => new SecretComponent(this.app, el)
						.setValue(this.plugin.settings.geminiApiKeyName)
						.onChange(async (value) => {
							this.plugin.settings.geminiApiKeyName = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Azure OpenAI Group ---
		new SettingGroup(containerEl)
			.setHeading('Azure OpenAI')
			.addSetting((setting: Setting) => {
				setting.setName('Azure Endpoint')
					.setDesc('Your Azure OpenAI Endpoint URL.')
					.addText(text => text
						.setPlaceholder('https://your-resource.openai.azure.com/')
						.setValue(this.plugin.settings.azureOpenAiEndpoint)
						.onChange(async (value) => {
							this.plugin.settings.azureOpenAiEndpoint = value;
							await this.plugin.saveSettings();
						}));
			})
			.addSetting((setting: Setting) => {
				setting.setName('Azure API Key')
					.setDesc('Select Azure OpenAI API key from SecretStorage')
					.addComponent(el => new SecretComponent(this.app, el)
						.setValue(this.plugin.settings.azureOpenAiKeyName)
						.onChange(async (value) => {
							this.plugin.settings.azureOpenAiKeyName = value;
							await this.plugin.saveSettings();
						}));
			});
	}
}
