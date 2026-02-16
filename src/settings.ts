import { App, PluginSettingTab, Setting, SettingGroup, TextComponent } from "obsidian";
import MyPlugin from "./main";
import { ModelInputSuggest } from "./llm/model-suggest-helper";
import { ModelConfigModal } from "./settings/model-config-modal";

export interface MyPluginSettings {
	// General
	systemPrompt: string;
	defaultModel: string;
	defaultTemperature: number;
	notebookFolder: string;
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

export const DEFAULT_SETTINGS: MyPluginSettings = {
	systemPrompt: 'You are a helpful assistant.',
	defaultModel: 'llama3',
	defaultTemperature: 0.7,
	notebookFolder: 'AI Chat Notebooks',
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
		text.setPlaceholder('Enter API Key...')
			.setValue(value)
			.onChange(onChange);
	});
}

export class InlineAIChatNotebookSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Inline AI Chat Notebook Settings' });

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
			})
			.addSetting((setting: Setting) => {
				setting.setName('Default Temperature')
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
			})
			.addSetting((setting: Setting) => {
				setting.setName('Notebook Folder')
					.setDesc('The folder where new chat notebooks will be created.')
					.addText(text => text
						.setPlaceholder('AI Chat Notebooks')
						.setValue(this.plugin.settings.notebookFolder)
						.onChange(async (value) => {
							this.plugin.settings.notebookFolder = value;
							await this.plugin.saveSettings();
						}));
			})
			.addSetting((setting: Setting) => {
				setting.setName('Configure available models')
					.setDesc('Choose which models appear in the suggestion lists.')
					.addButton(btn => btn
						.setButtonText('Configure')
						.onClick(() => {
							new ModelConfigModal(this.app, this.plugin).open();
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
				setting.setName('OpenAI API Key');
				addSensitiveSetting(setting, this.plugin.settings.openAiApiKeyName, async (value) => {
					this.plugin.settings.openAiApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Anthropic Group ---
		new SettingGroup(containerEl)
			.setHeading('Anthropic')
			.addSetting((setting: Setting) => {
				setting.setName('Anthropic API Key');
				addSensitiveSetting(setting, this.plugin.settings.anthropicApiKeyName, async (value) => {
					this.plugin.settings.anthropicApiKeyName = value;
					await this.plugin.saveSettings();
				});
			});

		// --- Google Gemini Group ---
		new SettingGroup(containerEl)
			.setHeading('Google Gemini')
			.addSetting((setting: Setting) => {
				setting.setName('Gemini API Key');
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
					.setDesc('Azure OpenAI Endpoint URL.')
					.addText((text: TextComponent) => text
						.setPlaceholder('https://your-resource.openai.azure.com/')
						.setValue(this.plugin.settings.azureOpenAiEndpoint)
						.onChange(async (value: string) => {
							this.plugin.settings.azureOpenAiEndpoint = value;
							await this.plugin.saveSettings();
						}));
			})
			.addSetting((setting: Setting) => {
				setting.setName('Azure API Key');
				addSensitiveSetting(setting, this.plugin.settings.azureOpenAiKeyName, async (value) => {
					this.plugin.settings.azureOpenAiKeyName = value;
					await this.plugin.saveSettings();
				});
			})
			.addSetting((setting: Setting) => {
				setting.setName('Deployment Names')
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
