import { Decoration, DecorationSet, WidgetType, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { Notice } from "obsidian";
import MyPlugin from "./main";
import { executeChat, isChatFile } from "./chat-logic";

class SubmitButtonWidget extends WidgetType {
	constructor(private plugin: MyPlugin) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement("div");
		container.classList.add("iter-submit-widget-container");
		
		const btn = container.createEl("button", { 
			text: "Submit to AI",
			cls: "iter-footer-btn"
		});

		btn.addEventListener("click", async (e) => {
			e.preventDefault();
			e.stopPropagation();
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (!activeFile) return;

			btn.innerText = "Thinking...";
			btn.disabled = true;
			try {
				await executeChat(this.plugin, activeFile);
			} catch (e) {
				new Notice("Error: " + (e instanceof Error ? e.message : String(e)));
			} finally {
				btn.innerText = "Submit to AI";
				btn.disabled = false;
			}
		});

		return container;
	}
}

export const chatFooterExtension = (plugin: MyPlugin) => ViewPlugin.fromClass(class {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.buildDecorations(update.view);
		}
	}

	buildDecorations(view: EditorView): DecorationSet {
		const activeFile = plugin.app.workspace.getActiveFile();
		if (!activeFile || !isChatFile(plugin.app, activeFile.path)) {
			return Decoration.none;
		}

		const builder = new RangeSetBuilder<Decoration>();
		const lastPos = view.state.doc.length;
		
		// Add as an inline widget at the very last position of the doc
		builder.add(lastPos, lastPos, Decoration.widget({
			widget: new SubmitButtonWidget(plugin),
			side: 1 // Ensure it stays after the last character
		}));

		return builder.finish();
	}
}, {
	decorations: v => v.decorations
});
