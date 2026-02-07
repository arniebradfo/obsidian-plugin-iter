import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Notice } from "obsidian";
import MyPlugin from "./main";
import { executeChat, isChatFile } from "./chat-logic";

export const chatFooterPlugin = (plugin: MyPlugin) => ViewPlugin.fromClass(class {
	footerEl: HTMLElement;

	constructor(view: EditorView) {
		this.footerEl = document.createElement("div");
		this.footerEl.classList.add("iter-persistent-footer");
		
		const btn = this.footerEl.createEl("button", { 
			text: "Submit to AI",
			cls: "iter-footer-btn"
		});

		btn.addEventListener("click", async () => {
			const activeFile = plugin.app.workspace.getActiveFile();
			if (!activeFile) return;

			btn.innerText = "Thinking...";
			btn.disabled = true;
			try {
				await executeChat(plugin, activeFile);
			} catch (e) {
				new Notice("Error: " + (e instanceof Error ? e.message : String(e)));
			} finally {
				btn.innerText = "Submit to AI";
				btn.disabled = false;
			}
		});

		// Add to the view
		view.dom.appendChild(this.footerEl);
		this.toggleVisibility(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.toggleVisibility(update.view);
		}
	}

	toggleVisibility(view: EditorView) {
		const activeFile = plugin.app.workspace.getActiveFile();
		if (activeFile && isChatFile(plugin.app, activeFile.path)) {
			this.footerEl.style.display = "flex";
		} else {
			this.footerEl.style.display = "none";
		}
	}

	destroy() {
		this.footerEl.remove();
	}
});
