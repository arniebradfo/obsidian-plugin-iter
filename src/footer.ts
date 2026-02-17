import { WidgetType, EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, Extension } from "@codemirror/state";
import { executeChat, hasTurnBlocks, trimAllMessages, handleAutoRename, parseChatContent, getProvider, abortChat } from "./chat-logic";
import { Notice, MarkdownView, TextComponent, setIcon } from "obsidian";
import MyPlugin from "./main";
import { ModelInputSuggest } from "./llm/model-suggest-helper";

class SubmitButtonWidget extends WidgetType {
	constructor(readonly plugin: MyPlugin) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapperEl = document.createElement("div");
		wrapperEl.classList.add("turn-chat-block", "turn-chat-block-submit");

		const submitContainer = wrapperEl.createDiv({ cls: "turn-submit-container" });

		// Left side: Info (Submit + Model + Temp)
		const info = submitContainer.createDiv({ cls: "turn-info" });
		// Right side: Controls (Add Message, Trim All, Rename, STOP)
		const controls = submitContainer.createDiv({ cls: "turn-controls" });

		const btn = info.createEl("button", {
			text: "Submit to AI",
			cls: "turn-footer-btn turn-submit-btn mod-cta"
		});

		// Model Input
		const modelInput = new TextComponent(info)
			.setPlaceholder("provider/model")
			.setValue(this.plugin.settings.defaultModel);

		modelInput.inputEl.addClass("turn-model-input");

		// Attach shared suggest logic
		new ModelInputSuggest(this.plugin.app, modelInput.inputEl, this.plugin);

		// Temperature Input
		const tempWrapper = info.createDiv({ cls: "turn-temp-wrapper" });
		tempWrapper.createSpan({ text: "Temp:", cls: "turn-temp-label" });
		const tempInput = tempWrapper.createEl("input", {
			type: "number",
			cls: "turn-temp-input",
			attr: {
				step: "0.1",
				min: "0",
				max: "1",
				title: "Temperature"
			}
		});
		tempInput.value = this.plugin.settings.defaultTemperature.toString();

		const renameBtn = controls.createEl("button", {
			cls: "turn-footer-btn turn-rename-btn clickable-icon"
		});
		setIcon(renameBtn, "file-type-corner");
		renameBtn.setAttr("aria-label", "Rename chat from summary");

		const trimAllBtn = controls.createEl("button", {
			cls: "turn-footer-btn turn-trim-all-btn clickable-icon"
		});
		setIcon(trimAllBtn, "scissors");
		trimAllBtn.setAttr("aria-label", "Trim all messages");

		const addMessageBtn = controls.createEl("button", {
			cls: "turn-footer-btn turn-add-msg-btn clickable-icon"
		});
		setIcon(addMessageBtn, "user-plus");
		addMessageBtn.setAttr("aria-label", "Add new message block");

		const stopBtn = controls.createEl("button", {
			text: "STOP",
			cls: "turn-footer-btn turn-stop-btn mod-destructive"
		});
		stopBtn.style.display = "none";

		btn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) return;

			const selectedModel = modelInput.getValue() || this.plugin.settings.defaultModel;
			const temperature = parseFloat(tempInput.value) || this.plugin.settings.defaultTemperature;

			try {
				await executeChat(this.plugin, activeFile, selectedModel, temperature);

				const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					const editor = markdownView.editor;
					const lineCount = editor.lineCount();
					editor.setCursor({ line: lineCount, ch: 0 });
					editor.focus();
				}
			} catch (e) {
				new Notice("Error: " + (e instanceof Error ? e.message : String(e)));
			}
		});

		stopBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (activeFile) {
				abortChat(activeFile);
			}
		});

		addMessageBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeFile || !markdownView) return;

			const editor = markdownView.editor;
			const newLine = `\n\n\`\`\`turn\nrole: user\n\`\`\`\n`;
			
			editor.replaceRange(newLine, { line: editor.lineCount(), ch: 0 });
			
			const lineCount = editor.lineCount();
			editor.setCursor({ line: lineCount, ch: 0 });
			editor.focus();
		});

		trimAllBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) return;
			await trimAllMessages(this.plugin, activeFile);
			new Notice("All messages trimmed.");
		});

		renameBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) return;

			const selectedModel = modelInput.getValue() || this.plugin.settings.defaultModel;
			const { provider, actualModel } = getProvider(this.plugin.app, this.plugin.settings, selectedModel);
			const content = view.state.doc.toString();

			try {
				const history = await parseChatContent(this.plugin.app, content);
				new Notice("Summarizing and renaming...");
				await handleAutoRename(this.plugin, activeFile, history, provider, actualModel);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				new Notice("Rename failed: " + msg);
			}
		});

		return wrapperEl;
	}

	eq(other: SubmitButtonWidget) { return true; }
}

export function createFooterExtension(plugin: MyPlugin): Extension {
	return StateField.define<DecorationSet>({
		create(state) {
			return Decoration.none;
		},
		update(value, tr) {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (!activeFile) return Decoration.none;

			const content = tr.state.doc.toString();
			if (!hasTurnBlocks(content)) {
				return Decoration.none;
			}

			const pos = tr.state.doc.length;
			return Decoration.set([
				Decoration.widget({
					widget: new SubmitButtonWidget(plugin),
					side: 1,
					block: true
				}).range(pos)
			]);
		},
		provide(field) {
			return EditorView.decorations.from(field);
		}
	});
}
