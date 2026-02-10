import { App, Modal, Setting, SettingGroup } from "obsidian";
import MyPlugin from "../main";
import { OllamaProvider } from "../llm/ollama";
import { OpenAIProvider } from "../llm/openai";
import { GeminiProvider } from "../llm/gemini";
import { AnthropicProvider } from "../llm/anthropic";
import { AzureOpenAIProvider } from "../llm/azure";

export class ModelConfigModal extends Modal {
	constructor(app: App, private plugin: MyPlugin) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Configure Available Models" });
		contentEl.createEl("p", { 
			text: "Turn models on or off to clean up your selection lists. Unchecked models will be hidden from the suggest picker.",
			cls: "setting-item-description"
		});

		const providers = [
			new OllamaProvider(this.plugin.settings),
			new OpenAIProvider(this.app, this.plugin.settings),
			new GeminiProvider(this.app, this.plugin.settings),
			new AnthropicProvider(this.app, this.plugin.settings),
			new AzureOpenAIProvider(this.app, this.plugin.settings)
		];

		const container = contentEl.createDiv({ cls: "iter-model-config-list" });

		for (const provider of providers) {
			const group = new SettingGroup(container);
			group.setHeading(provider.name);

			try {
				const models = await provider.listModels();
				if (models.length === 0) {
					group.addSetting(s => s.setDesc("No models found for this provider."));
				}

				models.forEach(modelName => {
					const modelId = `${provider.id}/${modelName}`;
					const isEnabled = this.plugin.settings.modelConfig[modelId] !== false;

					group.addSetting(setting => {
						setting.setName(modelName)
							.addToggle(toggle => toggle
								.setValue(isEnabled)
								.onChange(async (value) => {
									this.plugin.settings.modelConfig[modelId] = value;
									await this.plugin.saveSettings();
								}));
					});
				});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				group.addSetting(s => s.setDesc(`Error loading models: ${msg}`));
			}
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}