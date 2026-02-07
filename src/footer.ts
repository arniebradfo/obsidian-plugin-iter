import { WidgetType, EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, Extension } from "@codemirror/state";
import { executeChat, isChatFile } from "./chat-logic";
import { Notice, MarkdownView } from "obsidian";
import MyPlugin from "./main";

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

		btn.addEventListener("click", async (e) => {
			e.preventDefault();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) return;

			btn.innerText = "Thinking...";
			btn.disabled = true;
			try {
				await executeChat(this.plugin, activeFile);
				
				// Focus the editor and move cursor to the end
				const markdownView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					const editor = markdownView.editor;
					const lineCount = editor.lineCount();
					editor.setCursor({ line: lineCount, ch: 0 });
					editor.focus();
				}
			} catch (e) {
				new Notice("Error: " + (e instanceof Error ? e.message : String(e)));
			} finally {
				btn.innerText = "Submit to AI";
				btn.disabled = false;
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
