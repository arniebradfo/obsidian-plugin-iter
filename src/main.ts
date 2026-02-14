import { App, Plugin, TFile, Notice, MarkdownView, Editor } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, InlineAINotebookSettingTab } from "./settings";
import { registerCodeBlock } from "./codeblock";
import { createFooterExtension } from "./footer";
import { executeChat, isChatFile } from "./chat-logic";
import { ModelSuggest } from "./model-suggest";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		registerCodeBlock(this);
		this.registerEditorExtension(createFooterExtension(this));
		this.registerEditorSuggest(new ModelSuggest(this.app, this));

		this.addSettingTab(new InlineAINotebookSettingTab(this.app, this));

		this.addCommand({
			id: 'initialize-ai-notebook',
			name: 'Initialize AI Notebook',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					await this.initializeChatFile(activeFile);
				} else {
					new Notice("No active file found.");
				}
			}
		});

		this.addRibbonIcon('message-square-plus', 'Initialize AI Notebook', async () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				await this.initializeChatFile(activeFile);
			} else {
				new Notice("No active file found.");
			}
		});

		this.addCommand({
			id: 'submit-turn-chat',
			name: 'Submit to AI',
			hotkeys: [{ modifiers: ["Mod"], key: "Enter" }],
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file && isChatFile(this.app, activeView.file.path)) {
					if (!checking) {
						const modelInput = activeView.contentEl.querySelector(".turn-model-input") as HTMLInputElement;
						const selectedModel = modelInput?.value || this.settings.defaultModel;

						executeChat(this, activeView.file, selectedModel).then(() => {
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

		this.addCommand({
			id: 'insert-user-turn',
			name: 'Insert User Message Block',
			editorCallback: (editor: Editor) => {
				const block = `\n\n\`\`\`turn\nrole: user\n\`\`\`\n`;
				editor.replaceRange(block, editor.getCursor());
			}
		});

		this.addCommand({
			id: 'insert-assistant-turn',
			name: 'Insert Assistant Message Block',
			editorCallback: (editor: Editor) => {
				const block = `\n\n\`\`\`turn\nrole: assistant\n\`\`\`\n`;
				editor.replaceRange(block, editor.getCursor());
			}
		});

		this.addCommand({
			id: 'insert-system-turn-top',
			name: 'Insert System Message Block (Top)',
			editorCheckCallback: (checking: boolean, editor: Editor, view: MarkdownView) => {
				if (view.file && isChatFile(this.app, view.file.path)) {
					if (!checking) {
						const block = `\`\`\`turn\nrole: system\n\`\`\`\n${this.settings.systemPrompt}\n\n`;
						this.app.vault.read(view.file).then(content => {
							let newContent = content;
							if (content.startsWith("---")) {
								const endIdx = content.indexOf("---", 3);
								if (endIdx !== -1) {
									const afterFrontmatter = endIdx + 3;
									newContent = content.slice(0, afterFrontmatter) + "\n\n" + block + content.slice(afterFrontmatter);
								} else {
									newContent = block + content;
								}
							} else {
								newContent = block + content;
							}
							this.app.vault.modify(view.file!, newContent);
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
turn-chat: true
---

\`\`\`turn
role: system
\`\`\`
${this.settings.systemPrompt}

\`\`\`turn
role: user
\`\`\`
`;
		await this.app.vault.modify(file, frontmatter + "\n" + content);
		new Notice("Notebook initialized!");
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
