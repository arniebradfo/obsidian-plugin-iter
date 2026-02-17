import { App, Plugin, TFile, Notice, MarkdownView, Editor, TFolder } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, InlineAIChatNotebookSettingTab } from "./settings";
import { registerCodeBlock } from "./codeblock";
import { createFooterExtension } from "./footer";
import { executeChat, hasTurnBlocks, handleAutoRename, parseChatContent } from "./chat-logic";
import { getProvider } from "./llm/provider-factory";
import { ModelSuggest } from "./model-suggest";
import { TURN_BLOCK_START, SUBMIT_COMMAND_ID } from "./utils/constants";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		registerCodeBlock(this);
		this.registerEditorExtension(createFooterExtension(this));
		this.registerEditorSuggest(new ModelSuggest(this.app, this));

		this.addSettingTab(new InlineAIChatNotebookSettingTab(this.app, this));

		// Force re-render when file is renamed or changed to keep contexts fresh
		this.registerEvent(
			this.app.vault.on("rename", (file) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file === file) {
					// @ts-ignore
					activeView.previewMode?.rerender(true);
				}
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file === file) {
					// @ts-ignore
					activeView.previewMode?.rerender(true);
				}
			})
		);

		this.registerCommands();
		this.registerRibbonIcons();
	}

	registerCommands() {
		this.addCommand({
			id: 'rename-chat-summary',
			name: 'Rename Chat from Summary',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file) {
					const content = activeView.editor.getValue();
					if (hasTurnBlocks(content)) {
						if (!checking) {
							const modelInput = activeView.contentEl.querySelector(".turn-model-input") as HTMLInputElement;
							const selectedModel = modelInput?.value || this.settings.defaultModel;
							const { provider, actualModel } = getProvider(this.app, this.settings, selectedModel);
							
							parseChatContent(this.app, content).then(history => {
								new Notice("Summarizing and renaming...");
								handleAutoRename(this, activeView.file!, history, provider, actualModel);
							});
						}
						return true;
					}
				}
				return false;
			}
		});

		this.addCommand({
			id: 'initialize-ai-notebook',
			name: 'New AI Chat Notebook',
			callback: async () => {
				await this.createNewChatFile();
			}
		});

		this.addCommand({
			id: SUBMIT_COMMAND_ID,
			name: 'Submit to AI',
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "Enter" }],
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.file) {
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
				const block = `\n\n${TURN_BLOCK_START}\nrole: user\n\`\`\`\n`;
				editor.replaceRange(block, editor.getCursor());
			}
		});

		this.addCommand({
			id: 'insert-assistant-turn',
			name: 'Insert Assistant Message Block',
			editorCallback: (editor: Editor) => {
				const block = `\n\n${TURN_BLOCK_START}\nrole: assistant\n\`\`\`\n`;
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
							const block = `${TURN_BLOCK_START}\nrole: system\n\`\`\`\n${this.settings.systemPrompt}\n\n`;
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

	registerRibbonIcons() {
		this.addRibbonIcon('message-square-plus', 'New AI Chat Notebook', async () => {
			await this.createNewChatFile();
		});
	}

	async createNewChatFile() {
		const folderPath = this.settings.notebookFolder.trim() || "/";
		const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
		
		// Ensure folder exists
		if (folderPath !== "/" && !(await this.app.vault.adapter.exists(folderPath))) {
			await this.app.vault.createFolder(folderPath);
		}

		// Find next incrementing number for today
		let nextNum = 1;
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (folder instanceof TFolder) {
			const todayPrefix = `Chat - ${dateStr}`;
			const existingNums = folder.children
				.filter((f: any) => f.name.startsWith(todayPrefix))
				.map((f: any) => {
					// Expected format: "Chat - YYYY-MM-DD N.md"
					const parts = f.name.split(" ");
					if (parts.length >= 4) {
						const lastPart = parts[parts.length - 1].replace(".md", "");
						return parseInt(lastPart);
					}
					return NaN;
				})
				.filter((n: number) => !isNaN(n));
			
			if (existingNums.length > 0) {
				nextNum = Math.max(...existingNums) + 1;
			}
		}

		const fileName = `Chat - ${dateStr} ${nextNum}.md`;
		const filePath = folderPath === "/" ? fileName : `${folderPath}/${fileName}`;

		const content = `\n${TURN_BLOCK_START}
role: system
\`\`\`
${this.settings.systemPrompt}

${TURN_BLOCK_START}
role: user
\`\`\`
`;
		try {
			const file = await this.app.vault.create(filePath, content);
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
			
			new Notice("New chat created!");
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
