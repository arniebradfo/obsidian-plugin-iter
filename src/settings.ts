import { App, PluginSettingTab, Setting, SettingGroup, TextComponent } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	// General
	systemPrompt: string;
	defaultModel: string;

	// Providers
	ollamaUrl: string;
	openAiApiKey: string;
	anthropicApiKey: string;
	geminiApiKey: string;
	azureOpenAiKey: string;
	azureOpenAiEndpoint: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	systemPrompt: 'You are a helpful assistant.',
	defaultModel: 'llama3',
	ollamaUrl: 'http://localhost:11434',
	openAiApiKey: '',
	anthropicApiKey: '',
	geminiApiKey: '',
	azureOpenAiKey: '',
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

		// --- General Group ---
		new SettingGroup(containerEl)
			.setHeading('Iter LLM Settings')
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
					.addText((text: TextComponent) => text
						.setPlaceholder('http://localhost:11434')
						.setValue(this.plugin.settings.ollamaUrl)
						.onChange(async (value: string) => {
							this.plugin.settings.ollamaUrl = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- OpenAI Group ---
		new SettingGroup(containerEl)
			.setHeading('OpenAI')
			.addSetting((setting: Setting) => {
				setting.setName('OpenAI API Key')
					.setDesc('Your OpenAI API key.')
					.addText((text: TextComponent) => text
						.setPlaceholder('sk-...')
						.setValue(this.plugin.settings.openAiApiKey)
						.onChange(async (value: string) => {
							this.plugin.settings.openAiApiKey = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Anthropic Group ---
		new SettingGroup(containerEl)
			.setHeading('Anthropic')
			.addSetting((setting: Setting) => {
				setting.setName('Anthropic API Key')
					.setDesc('Your Anthropic API key.')
					.addText((text: TextComponent) => text
						.setPlaceholder('sk-ant-...')
						.setValue(this.plugin.settings.anthropicApiKey)
						.onChange(async (value: string) => {
							this.plugin.settings.anthropicApiKey = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Google Gemini Group ---
		new SettingGroup(containerEl)
			.setHeading('Google Gemini')
			.addSetting((setting: Setting) => {
				setting.setName('Gemini API Key')
					.setDesc('Your Google Gemini API key.')
					.addText((text: TextComponent) => text
						.setPlaceholder('AIza...')
						.setValue(this.plugin.settings.geminiApiKey)
						.onChange(async (value: string) => {
							this.plugin.settings.geminiApiKey = value;
							await this.plugin.saveSettings();
						}));
			});

		// --- Azure OpenAI Group ---
		new SettingGroup(containerEl)
			.setHeading('Azure OpenAI')
			.addSetting((setting: Setting) => {
				setting.setName('Azure Endpoint')
					.setDesc('Your Azure OpenAI Endpoint URL.')
					.addText((text: TextComponent) => text
						.setPlaceholder('https://your-resource.openai.azure.com/')
						.setValue(this.plugin.settings.azureOpenAiEndpoint)
						.onChange(async (value: string) => {
							this.plugin.settings.azureOpenAiEndpoint = value;
							await this.plugin.saveSettings();
						}));
			})
			.addSetting((setting: Setting) => {
				setting.setName('Azure API Key')
					.setDesc('Your Azure OpenAI API key.')
					.addText((text: TextComponent) => text
						.setPlaceholder('...')
						.setValue(this.plugin.settings.azureOpenAiKey)
						.onChange(async (value: string) => {
							this.plugin.settings.azureOpenAiKey = value;
							await this.plugin.saveSettings();
						}));
			});
	}
}