import { App, PluginSettingTab, Setting, SettingGroup, TextComponent } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	// General
	systemPrompt: string;
	defaultModel: string;

	// Providers (currently storing actual keys due to Obsidian SecretStorage issues)
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

/**
 * Helper to add a sensitive setting (API Key). 
 * Easy to swap between TextComponent and SecretComponent later.
 */
function addSensitiveSetting(setting: Setting, value: string, onChange: (value: string) => Promise<void>) {
	setting.addText((text: TextComponent) => {
		text.inputEl.type = 'text'; // "password"; // Hide key from prying eyes
		text.setPlaceholder('Enter API Key...')
			.setValue(value)
			.onChange(onChange);
	});
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
					.setDesc('Your OpenAI API key.');
				addSensitiveSetting(setting, this.plugin.settings.openAiApiKeyName, async (value) => {
					this.plugin.settings.openAiApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Anthropic Group ---
		new SettingGroup(containerEl)
			.setHeading('Anthropic')
			.addSetting((setting: Setting) => {
				setting.setName('Anthropic API Key')
					.setDesc('Your Anthropic API key.');
				addSensitiveSetting(setting, this.plugin.settings.anthropicApiKeyName, async (value) => {
					this.plugin.settings.anthropicApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Google Gemini Group ---
		new SettingGroup(containerEl)
			.setHeading('Google Gemini')
			.addSetting((setting: Setting) => {
				setting.setName('Gemini API Key')
					.setDesc('Your Google Gemini API key.');
				addSensitiveSetting(setting, this.plugin.settings.geminiApiKeyName, async (value) => {
					this.plugin.settings.geminiApiKeyName = value;
					await this.plugin.saveSettings();
				});
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
					.setDesc('Your Azure OpenAI API key.');
				addSensitiveSetting(setting, this.plugin.settings.azureOpenAiKeyName, async (value) => {
					this.plugin.settings.azureOpenAiKeyName = value;
					await this.plugin.saveSettings();
				});
			});
	}
}