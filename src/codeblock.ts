import { MarkdownPostProcessorContext, parseYaml, Notice, setIcon } from "obsidian";
import MyPlugin from "./main";
import { isChatFile, trimAllMessages } from "./chat-logic";

export function registerCodeBlock(plugin: MyPlugin) {
	plugin.registerMarkdownCodeBlockProcessor(
		"turn",
		async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			if (!isChatFile(plugin.app, ctx.sourcePath)) {
				const pre = el.createEl("pre");
				pre.createEl("code", { text: "```turn\n" + source + "\n```" });
				return;
			}

			const config = parseYaml(source) || {};
			el.classList.add("turn-chat-block");

			renderMetadataBlock(el, config, plugin, ctx, el);
		}
	);
}

function renderMetadataBlock(container: HTMLElement, config: any, plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const role = config.role || "user";
	const isSystem = role === "system";
	
	const header = container.createDiv({ cls: "turn-block-header" });
	
	// Left side: Info
	const info = header.createDiv({ cls: "turn-info" });
	const roleContainer = info.createDiv({ cls: "turn-role-container" });

	if (isSystem) {
		const span = roleContainer.createSpan({ 
			cls: `turn-role turn-role-system` 
		});
		setIcon(span, "shield");
	} else {
		const roleToggle = roleContainer.createEl("button", { 
			cls: `turn-role turn-role-${role} clickable-icon` 
		});
		
		const iconName = role === "user" ? "user" : "bot";
		setIcon(roleToggle, iconName);
		
		const newRole = role === "user" ? "assistant" : "user";
		roleToggle.setAttr("aria-label", `Switch to ${newRole}`);

		roleToggle.addEventListener("click", async () => {
			await toggleRoleInFile(plugin, ctx, newRole, el);
		});
	}

	roleContainer.createSpan({
		cls: "turn-role-label",
		text: role.toUpperCase()
	});

	if (config.model) {
		info.createSpan({ text: "/", cls: "turn-spacer" });
		info.createSpan({ text: config.model, cls: "turn-model-info turn-metadata" });
	}

	if (config.temp !== undefined) {
		info.createSpan({ text: "/", cls: "turn-spacer" });
		info.createSpan({ text: `T: ${config.temp}`, cls: "turn-temp-info turn-metadata" });
	}
	
	// Right side: Controls
	const controls = header.createDiv({ cls: "turn-controls" });

	const trimBtn = controls.createEl("button", {
		cls: "turn-trim-btn clickable-icon"
	});
	setIcon(trimBtn, "scissors");
	trimBtn.setAttr("aria-label", "Trim blank lines");
	trimBtn.addEventListener("click", async () => {
		await trimSectionInFile(plugin, ctx, el);
	});

	const deleteBtn = controls.createEl("button", {
		cls: "turn-delete-btn clickable-icon mod-destructive"
	});
	setIcon(deleteBtn, "trash");
	deleteBtn.setAttr("aria-label", "Delete message");

	deleteBtn.addEventListener("click", async () => {
		await deleteSectionFromFile(plugin, ctx, el);
	});
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
		if (lines[i]?.trim().startsWith("```turn")) {
			deleteUntil = i;
			break;
		}
	}

	lines.splice(section.lineStart, deleteUntil - section.lineStart);
	await plugin.app.vault.modify(file as any, lines.join("\n"));
}

async function trimSectionInFile(plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!file || !("extension" in file)) return;

	const content = await plugin.app.vault.read(file as any);
	const lines = content.split("\n");
	
	const section = ctx.getSectionInfo(el);
	if (!section) return;

	let messageEnd = lines.length;
	for (let i = section.lineEnd + 1; i < lines.length; i++) {
		if (lines[i]?.trim().startsWith("```turn")) {
			messageEnd = i;
			break;
		}
	}

	const messageLines = lines.slice(section.lineEnd + 1, messageEnd);
	
	while (messageLines.length > 0 && messageLines[0]?.trim() === "") {
		messageLines.shift();
	}
	while (messageLines.length > 0 && messageLines[messageLines.length - 1]?.trim() === "") {
		messageLines.pop();
	}

	const newLines = [
		...lines.slice(0, section.lineEnd + 1),
		...messageLines,
		...lines.slice(messageEnd)
	];

	await plugin.app.vault.modify(file as any, newLines.join("\n"));
}
