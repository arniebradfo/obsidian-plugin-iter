import { App, PluginSettingTab, Setting } from "obsidian";
import MyPlugin from "./main";

export interface MyPluginSettings {
	apiEndpoint: string;
	showExecuteButton: boolean;
	theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	apiEndpoint: 'https://api.example.com',
	showExecuteButton: true,
	theme: 'system'
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

		containerEl.createEl('h2', { text: 'Iter Plugin Settings' });

		new Setting(containerEl)
			.setName('API Endpoint')
			.setDesc('Endpoint for the iteration service')
			.addText(text => text
				.setPlaceholder('Enter endpoint')
				.setValue(this.plugin.settings.apiEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.apiEndpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show Execute Button')
			.setDesc('Whether to show the execute button in the code blocks')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showExecuteButton)
				.onChange(async (value) => {
					this.plugin.settings.showExecuteButton = value;
					await this.plugin.saveSettings();
				}));
				
		new Setting(containerEl)
			.setName('Theme')
			.setDesc('Choose the appearance for Iter blocks')
			.addDropdown(dropdown => dropdown
				.addOption('light', 'Light')
				.addOption('dark', 'Dark')
				.addOption('system', 'System')
				.setValue(this.plugin.settings.theme)
				.onChange(async (value: 'light' | 'dark' | 'system') => {
					this.plugin.settings.theme = value;
					await this.plugin.saveSettings();
				}));
	}
}