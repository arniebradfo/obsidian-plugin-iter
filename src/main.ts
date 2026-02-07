import { App, Plugin, TFile, Notice } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";
import { registerCodeBlock } from "./codeblock";
import { createFooterExtension } from "./footer";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		registerCodeBlock(this);
		this.registerEditorExtension(createFooterExtension(this));

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.addCommand({
			id: 'initialize-iter-chat',
			name: 'Initialize Iter Chat',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					await this.initializeChatFile(activeFile);
				} else {
					new Notice("No active file found.");
				}
			}
		});
	}

	async initializeChatFile(file: TFile) {
		const content = await this.app.vault.read(file);
		const frontmatter = `---
iter-chat: true
model: ${this.settings.defaultModel}
---

\`\`\`iter
role: system
\`\`\`
${this.settings.systemPrompt}

\`\`\`iter
role: user
\`\`\`
`;
		await this.app.vault.modify(file, frontmatter + "\n" + content);
		new Notice("Chat initialized!");
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}