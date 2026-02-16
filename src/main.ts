import { App, Plugin, TFile, Notice, MarkdownView, Editor } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, InlineAINotebookSettingTab } from "./settings";
import { registerCodeBlock } from "./codeblock";
import { createFooterExtension } from "./footer";
import { executeChat, hasTurnBlocks } from "./chat-logic";
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
			name: 'New AI Notebook',
			callback: async () => {
				await this.createNewChatFile();
			}
		});

		this.addRibbonIcon('message-square-plus', 'New AI Notebook', async () => {
			await this.createNewChatFile();
		});

		this.addCommand({
			id: 'submit-turn-chat',
			name: 'Submit to AI',
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Enter" }],
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file) {
					// Check if file content has turn blocks
					const editor = activeView.editor;
					const content = editor.getValue();
					
					if (hasTurnBlocks(content)) {
						if (!checking) {
							const modelInput = activeView.contentEl.querySelector(".turn-model-input") as HTMLInputElement;
							const tempInput = activeView.contentEl.querySelector(".turn-temp-input") as HTMLInputElement;
							
							const selectedModel = modelInput?.value || this.settings.defaultModel;
							const temperature = tempInput ? parseFloat(tempInput.value) : this.settings.defaultTemperature;

							executeChat(this, activeView.file, selectedModel, temperature).then(() => {
								const lineCount = editor.lineCount();
								editor.setCursor({ line: lineCount, ch: 0 });
								editor.focus();
							});
						}
						return true;
					}
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
				if (view.file) {
					const content = editor.getValue();
					if (hasTurnBlocks(content)) {
						if (!checking) {
							const block = `\`\`\`turn\nrole: system\n\`\`\`\n${this.settings.systemPrompt}\n\n`;
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
							editor.setValue(newContent);
						}
						return true;
					}
				}
				return false;
			}
		});
	}

	async createNewChatFile() {
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", " ").slice(0, 19);
		const fileName = `AI Notebook ${timestamp}.md`;
		const content = `\n\`\`\`turn
role: system
\`\`\`
${this.settings.systemPrompt}

\`\`\`turn
role: user
\`\`\`
`;
		try {
			const file = await this.app.vault.create(fileName, content);
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file);
			
			// Move cursor to end
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				const editor = activeView.editor;
				const lineCount = editor.lineCount();
				editor.setCursor({ line: lineCount, ch: 0 });
				editor.focus();
			}
			
			new Notice("New notebook created!");
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			new Notice("Error creating file: " + msg);
		}
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
