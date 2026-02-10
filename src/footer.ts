import { WidgetType, EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, Extension } from "@codemirror/state";
import { executeChat, isChatFile } from "./chat-logic";
import { Notice, MarkdownView, TextComponent } from "obsidian";
import MyPlugin from "./main";
import { ModelInputSuggest } from "./llm/model-suggest-helper";

class SubmitButtonWidget extends WidgetType {
	constructor(readonly plugin: MyPlugin) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const div = document.createElement("div");
		div.classList.add("iter-submit-container");

		const btn = div.createEl("button", {
			text: "Submit to AI",
			cls: "iter-footer-btn"
		});

		// Model Input
		const modelInputWrapper = div.createDiv({ cls: "iter-model-input-wrapper" });
		const modelInput = new TextComponent(modelInputWrapper)
			.setPlaceholder("provider/model")
			.setValue(this.plugin.settings.defaultModel);
		
		modelInput.inputEl.addClass("iter-model-input");
		
		// Attach shared suggest logic
		new ModelInputSuggest(this.plugin.app, modelInput.inputEl, this.plugin);

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

		return div;
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