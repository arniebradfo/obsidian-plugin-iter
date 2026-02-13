import { WidgetType, EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, Extension } from "@codemirror/state";
import { executeChat, isChatFile, trimAllMessages } from "./chat-logic";
import { Notice, MarkdownView, TextComponent, setIcon } from "obsidian";
import MyPlugin from "./main";
import { ModelInputSuggest } from "./llm/model-suggest-helper";

class SubmitButtonWidget extends WidgetType {
	constructor(readonly plugin: MyPlugin) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const wrapperEl = document.createElement("div");
		wrapperEl.classList.add("iter-chat-block", "iter-chat-block-submit");

		const submitContainer = wrapperEl.createDiv({ cls: "iter-submit-container" });

		// Left side: Info (Submit + Model)
		const info = submitContainer.createDiv({ cls: "iter-info" });
		// Right side: Controls (Add Message, Trim All)
		const controls = submitContainer.createDiv({ cls: "iter-controls" });

		const btn = info.createEl("button", {
			text: "Submit to AI",
			cls: "iter-footer-btn iter-submit-btn mod-cta"
		});

		// Model Input
		const modelInput = new TextComponent(info)
			.setPlaceholder("provider/model")
			.setValue(this.plugin.settings.defaultModel);

		modelInput.inputEl.addClass("iter-model-input");

		// Attach shared suggest logic
		new ModelInputSuggest(this.plugin.app, modelInput.inputEl, this.plugin);

		const trimAllBtn = controls.createEl("button", {
			cls: "iter-footer-btn iter-trim-all-btn clickable-icon"
		});
		setIcon(trimAllBtn, "square-scissors");
		trimAllBtn.setAttr("aria-label", "Trim all messages");

		const addMessageBtn = controls.createEl("button", {
			cls: "iter-footer-btn iter-add-msg-btn clickable-icon"
		});
		setIcon(addMessageBtn, "user-plus");
		addMessageBtn.setAttr("aria-label", "Add new message block");

		btn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) return;

			const selectedModel = modelInput.getValue() || this.plugin.settings.defaultModel;

			try {
				await executeChat(this.plugin, activeFile, selectedModel);

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

		addMessageBtn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!activeFile || !markdownView) return;

			const editor = markdownView.editor;
			const newLine = `\n\n\`\`\`iter\nrole: user\n\`\`\`\n`;
			
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
			if (!activeFile || !isChatFile(plugin.app, activeFile.path)) {
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
