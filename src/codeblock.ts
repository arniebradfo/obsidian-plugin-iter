import { MarkdownPostProcessorContext, parseYaml, Notice } from "obsidian";
import MyPlugin from "./main";
import { isChatFile } from "./chat-logic";

export function registerCodeBlock(plugin: MyPlugin) {
	plugin.registerMarkdownCodeBlockProcessor(
		"iter",
		async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			if (!isChatFile(plugin.app, ctx.sourcePath)) {
				const pre = el.createEl("pre");
				pre.createEl("code", { text: "```iter\n" + source + "\n```" });
				return;
			}

			const config = parseYaml(source) || {};
			const container = el.createDiv({ cls: "iter-chat-block iter-metadata-block" });

			renderMetadataBlock(container, config, plugin, ctx, el);
		}
	);
}

function renderMetadataBlock(container: HTMLElement, config: any, plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const role = config.role || "user";
	
	const header = container.createDiv({ cls: "iter-block-header" });
	header.createSpan({ text: `Role: `, cls: "iter-label" });
	const roleToggle = header.createEl("button", { 
		text: role.toUpperCase(), 
		cls: `iter-role-btn iter-role-${role}` 
	});

	roleToggle.addEventListener("click", async () => {
		const newRole = role === "user" ? "assistant" : "user";
		await toggleRoleInFile(plugin, ctx, newRole, el);
	});

	const deleteBtn = header.createEl("button", {
		text: "Delete",
		cls: "iter-delete-btn"
	});
	deleteBtn.addEventListener("click", async () => {
		await deleteSectionFromFile(plugin, ctx, el);
	});

	if (config.model) {
		header.createSpan({ text: ` | Model: ${config.model}`, cls: "iter-model-info" });
	}
}

async function toggleRoleInFile(plugin: MyPlugin, ctx: MarkdownPostProcessorContext, newRole: string, el: HTMLElement) {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!file || !("extension" in file)) return;

	const content = await plugin.app.vault.read(file as any);
	const lines = content.split("\n");
	
	const section = ctx.getSectionInfo(el);
	if (section) {
		lines[section.lineStart + 1] = `role: ${newRole}`;
		await plugin.app.vault.modify(file as any, lines.join("\n"));
	}
}

async function deleteSectionFromFile(plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!file || !("extension" in file)) return;

	const content = await plugin.app.vault.read(file as any);
	const lines = content.split("\n");
	
	const section = ctx.getSectionInfo(el);
	if (!section) return;

	let deleteUntil = lines.length;
	for (let i = section.lineEnd + 1; i < lines.length; i++) {
		if (lines[i]?.trim().startsWith("```iter")) {
			deleteUntil = i;
			break;
		}
	}

	lines.splice(section.lineStart, deleteUntil - section.lineStart);
	await plugin.app.vault.modify(file as any, lines.join("\n"));
}