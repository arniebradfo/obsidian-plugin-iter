import { MarkdownPostProcessorContext, parseYaml, Notice, setIcon } from "obsidian";
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
			el.classList.add("iter-chat-block");

			renderMetadataBlock(el, config, plugin, ctx, el);
		}
	);
}

function renderMetadataBlock(container: HTMLElement, config: any, plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const role = config.role || "user";
	const isSystem = role === "system";
	
	const header = container.createDiv({ cls: "iter-block-header" });
	
	if (isSystem) {
		const span = header.createSpan({ 
			cls: `iter-role-display iter-role-system` 
		});
		setIcon(span, "shield");
	} else {
		const roleToggle = header.createEl("button", { 
			cls: `iter-role-btn iter-role-${role} clickable-icon` 
		});
		
		const iconName = role === "user" ? "user" : "bot";
		setIcon(roleToggle, iconName);
		roleToggle.setAttr("aria-label", role.toUpperCase()); 

		roleToggle.addEventListener("click", async () => {
			const newRole = role === "user" ? "assistant" : "user";
			await toggleRoleInFile(plugin, ctx, newRole, el);
		});
	}

	if (config.model) {
		header.createSpan({ text: ` | Model: ${config.model}`, cls: "iter-model-info" });
	}
	
	const trimBtn = header.createEl("button", {
		cls: "iter-trim-btn clickable-icon"
	});
	setIcon(trimBtn, "scissors");
	trimBtn.setAttr("aria-label", "Trim blank lines");
	trimBtn.addEventListener("click", async () => {
		await trimSectionInFile(plugin, ctx, el);
	});

	const deleteBtn = header.createEl("button", {
		cls: "iter-delete-btn clickable-icon mod-destructive"
	});
	setIcon(deleteBtn, "trash");
	deleteBtn.setAttr("aria-label", "Delete message");

	deleteBtn.addEventListener("click", async () => {
		await deleteSectionFromFile(plugin, ctx, el);
	});

}

async function trimSectionInFile(plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!file || !("extension" in file)) return;

	const content = await plugin.app.vault.read(file as any);
	const lines = content.split("\n");
	
	const section = ctx.getSectionInfo(el);
	if (!section) return;

	// Find the end of this message (start of next block or end of file)
	let messageEnd = lines.length;
	for (let i = section.lineEnd + 1; i < lines.length; i++) {
		if (lines[i]?.trim().startsWith("```iter")) {
			messageEnd = i;
			break;
		}
	}

	const messageLines = lines.slice(section.lineEnd + 1, messageEnd);
	
	// Trim start
	while (messageLines.length > 0 && messageLines[0]?.trim() === "") {
		messageLines.shift();
	}
	// Trim end
	while (messageLines.length > 0 && messageLines[messageLines.length - 1]?.trim() === "") {
		messageLines.pop();
	}

	// Reconstruct: block + trimmed message + remaining file
	const newLines = [
		...lines.slice(0, section.lineEnd + 1),
		...messageLines,
		...lines.slice(messageEnd)
	];

	await plugin.app.vault.modify(file as any, newLines.join("\n"));
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
