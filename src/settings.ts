import { App, PluginSettingTab, Setting, SettingGroup, TextComponent } from "obsidian";
import InlineAIChatNotebookPlugin from "./main";
import { ModelInputSuggest } from "./llm/model-suggest-helper";
import { ModelConfigModal } from "./settings/model-config-modal";

export interface InlineAIChatNotebookSettings {
	// General
	systemPrompt: string;
	defaultModel: string;
	defaultTemperature: number;
	notebookFolder: string;
	autoRename: boolean;
	modelConfig: Record<string, boolean>;

	// Providers
	ollamaUrl: string;
	openAiApiKeyName: string;
	anthropicApiKeyName: string;
	geminiApiKeyName: string;
	azureOpenAiKeyName: string;
	azureOpenAiEndpoint: string;
	azureOpenAiModels: string;
}

export const DEFAULT_SETTINGS: InlineAIChatNotebookSettings = {
	systemPrompt: 'You are a helpful assistant.',
	defaultModel: 'llama3',
	defaultTemperature: 0.7,
	notebookFolder: 'AI Chat Notebooks',
	autoRename: true,
	modelConfig: {},
	ollamaUrl: 'http://localhost:11434',
	openAiApiKeyName: '',
	anthropicApiKeyName: '',
	geminiApiKeyName: '',
	azureOpenAiKeyName: '',
	azureOpenAiEndpoint: '',
	azureOpenAiModels: 'gpt-4o,gpt-35-turbo'
}

function addSensitiveSetting(setting: Setting, value: string, onChange: (value: string) => Promise<void>) {
	setting.addText((text: TextComponent) => {
		text.inputEl.type = "password";
		text.setPlaceholder('Enter API key...')
			.setValue(value)
			.onChange(onChange);
	});
}

export class InlineAIChatNotebookSettingTab extends PluginSettingTab {
	plugin: InlineAIChatNotebookPlugin;

	constructor(app: App, plugin: InlineAIChatNotebookPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Guideline: Keep general settings at the top without a heading if multiple sections exist.
		new Setting(containerEl)
			.setName('Default system prompt')
			.setDesc('The default system prompt for new chat files.')
			.addTextArea(text => text
				.setPlaceholder('You are a helpful assistant.')
				.setValue(this.plugin.settings.systemPrompt)
				.onChange(async (value) => {
					this.plugin.settings.systemPrompt = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default model name')
			.setDesc('The fallback model identifier.')
			.addText(text => {
				text.setPlaceholder('llama3')
					.setValue(this.plugin.settings.defaultModel)
					.onChange(async (value) => {
						this.plugin.settings.defaultModel = value;
						await this.plugin.saveSettings();
					});
				new ModelInputSuggest(this.app, text.inputEl, this.plugin);
			});

		new Setting(containerEl)
			.setName('Default temperature')
			.setDesc('The fallback creativity level (0.0 to 1.0).')
			.addText(text => {
				text.inputEl.type = "number";
				text.setPlaceholder('0.7')
					.setValue(this.plugin.settings.defaultTemperature.toString())
					.onChange(async (value) => {
						const val = parseFloat(value);
						if (!isNaN(val)) {
							this.plugin.settings.defaultTemperature = val;
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.setAttribute("step", "0.1");
				text.inputEl.setAttribute("min", "0");
				text.inputEl.setAttribute("max", "1");
			});

		new Setting(containerEl)
			.setName('Notebook folder')
			.setDesc('The folder where new chat notebooks will be created.')
			.addText(text => text
				.setPlaceholder('AI Chat Notebooks')
				.setValue(this.plugin.settings.notebookFolder)
				.onChange(async (value) => {
					this.plugin.settings.notebookFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-rename chats')
			.setDesc('Automatically rename chat files after the second assistant response based on a summary.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoRename)
				.onChange(async (value) => {
					this.plugin.settings.autoRename = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Configure available models')
			.setDesc('Choose which models appear in the suggestion lists.')
			.addButton(btn => btn
				.setButtonText('Configure')
				.onClick(() => {
					new ModelConfigModal(this.app, this.plugin).open();
				}));

		// --- Ollama Section ---
		new SettingGroup(containerEl)
			.setHeading('Ollama (local)')
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

		// --- OpenAI Section ---
		new SettingGroup(containerEl)
			.setHeading('OpenAI')
			.addSetting((setting: Setting) => {
				setting.setName('OpenAI API key');
				addSensitiveSetting(setting, this.plugin.settings.openAiApiKeyName, async (value) => {
					this.plugin.settings.openAiApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Anthropic Section ---
		new SettingGroup(containerEl)
			.setHeading('Anthropic')
			.addSetting((setting: Setting) => {
				setting.setName('Anthropic API key');
				addSensitiveSetting(setting, this.plugin.settings.anthropicApiKeyName, async (value) => {
					this.plugin.settings.anthropicApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Google Gemini Section ---
		new SettingGroup(containerEl)
			.setHeading('Google Gemini')
			.addSetting((setting: Setting) => {
				setting.setName('Gemini API key');
				addSensitiveSetting(setting, this.plugin.settings.geminiApiKeyName, async (value) => {
					this.plugin.settings.geminiApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Azure OpenAI Section ---
		new SettingGroup(containerEl)
			.setHeading('Azure OpenAI')
			.addSetting((setting: Setting) => {
				setting.setName('Azure endpoint')
					.setDesc('Azure OpenAI endpoint URL.')
					.addText((text: TextComponent) => text
						.setPlaceholder('https://your-resource.openai.azure.com/')
						.setValue(this.plugin.settings.azureOpenAiEndpoint)
						.onChange(async (value: string) => {
							this.plugin.settings.azureOpenAiEndpoint = value;
							await this.plugin.saveSettings();
						}));
			})
			.addSetting((setting: Setting) => {
				setting.setName('Azure API key');
				addSensitiveSetting(setting, this.plugin.settings.azureOpenAiKeyName, async (value) => {
					this.plugin.settings.azureOpenAiKeyName = value;
					await this.plugin.saveSettings();
				});
			})
			.addSetting((setting: Setting) => {
				setting.setName('Deployment names')
					.setDesc('Comma-separated list of your Azure deployment IDs.')
					.addText((text: TextComponent) => text
						.setPlaceholder('deployment1,deployment2')
						.setValue(this.plugin.settings.azureOpenAiModels)
						.onChange(async (value: string) => {
							this.plugin.settings.azureOpenAiModels = value;
							await this.plugin.saveSettings();
						}));
			});
	}
}
