import { MarkdownPostProcessorContext } from "obsidian";

export function registerCodeBlock(plugin: any) {
	plugin.registerMarkdownCodeBlockProcessor(
		"iter-control",
		(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const rows = source.split("\n").filter((row) => row.trim().length > 0);
			
			const container = el.createDiv({ cls: "iter-codeblock-control" });
			container.style.border = "2px solid var(--interactive-accent)";
			container.style.borderRadius = "8px";
			container.style.padding = "15px";
			container.style.backgroundColor = "var(--background-primary-alt)";
			container.style.boxShadow = "var(--input-shadow)";

			const header = container.createEl("h4", { text: "Code Block Control" });
			header.style.margin = "0 0 10px 0";
			header.style.color = "var(--text-accent)";

			const list = container.createEl("ul");
			list.style.margin = "0 0 15px 0";
			list.style.paddingLeft = "20px";

			rows.forEach((row) => {
				list.createEl("li", { text: row });
			});

			const actionContainer = container.createDiv();
			actionContainer.style.display = "flex";
			actionContainer.style.gap = "10px";

			const btn1 = actionContainer.createEl("button", { text: "Action A" });
			btn1.addEventListener("click", () => console.log("CodeBlock: Action A clicked", rows));

			const btn2 = actionContainer.createEl("button", { text: "Action B" });
			btn2.addEventListener("click", () => console.log("CodeBlock: Action B clicked", rows));
		}
	);
}