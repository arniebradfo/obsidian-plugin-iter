import { App, Modal, Setting, setIcon } from "obsidian";
import InlineAIChatNotebookPlugin from "../main";
import { getAllAvailableModels } from "../llm/model-suggest-helper";

export class ModelConfigModal extends Modal {
	constructor(app: App, private plugin: InlineAIChatNotebookPlugin) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Configure available models" });
		contentEl.createEl("p", { text: "Toggle which models appear in the autocomplete suggestion lists." });

		const allModels = await getAllAvailableModels(this.app, this.plugin);
		
		// We also want to show models that are currently hidden
		const configKeys = Object.keys(this.plugin.settings.modelConfig);
		const combined = Array.from(new Set([...allModels, ...configKeys])).sort();

		for (const modelId of combined) {
			new Setting(contentEl)
				.setName(modelId)
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.modelConfig[modelId] !== false)
					.onChange(async (value) => {
						this.plugin.settings.modelConfig[modelId] = value;
						await this.plugin.saveSettings();
					}));
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
