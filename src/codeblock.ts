import { MarkdownPostProcessorContext, MarkdownRenderer } from "obsidian";

export function registerCodeBlock(plugin: any) {
	plugin.registerMarkdownCodeBlockProcessor(
		"iter",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const container = el.createDiv({ cls: "iter-block-container" });
			
			// For now, let's just render the source as markdown inside our styled block
			// This provides a foundation for more complex logic later
			MarkdownRenderer.renderMarkdown(source, container, ctx.sourcePath, plugin);
			
			// Add some basic styling or buttons if needed for this "block approach"
			const footer = container.createDiv({ cls: "iter-block-footer" });
			const btn = footer.createEl("button", { text: "Execute Iter" });
			btn.addEventListener("click", () => {
				console.log("Iter block execution triggered for:", source);
			});
		}
	);
}
