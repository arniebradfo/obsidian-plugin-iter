import { App, Plugin, TFile, Notice, MarkdownView } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";
import { registerCodeBlock } from "./codeblock";
import { createFooterExtension } from "./footer";
import { executeChat, isChatFile } from "./chat-logic";

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

		this.addCommand({
			id: 'submit-iter-chat',
			name: 'Submit Iter Chat',
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file && isChatFile(this.app, activeView.file.path)) {
					if (!checking) {
						executeChat(this, activeView.file).then(() => {
							const editor = activeView.editor;
							const lineCount = editor.lineCount();
							editor.setCursor({ line: lineCount, ch: 0 });
							editor.focus();
						});
					}
					return true;
				}
				return false;
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