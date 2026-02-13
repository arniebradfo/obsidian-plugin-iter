import { MarkdownPostProcessorContext, parseYaml, Notice, setIcon, TFile } from "obsidian";
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

			// Check if this is the first iter block in the file
			const section = ctx.getSectionInfo(el);
			if (section) {
				const activeFile = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
				if (activeFile instanceof TFile) {
					const content = await plugin.app.vault.read(activeFile);
					const linesBefore = content.split("\n").slice(0, section.lineStart);
					const isFirst = !linesBefore.some(line => line.trim().startsWith("```iter"));
					if (isFirst) {
						el.classList.add("iter-first-block");
					}
				}
			}

			renderMetadataBlock(el, config, plugin, ctx, el);
		}
	);
}

function renderMetadataBlock(container: HTMLElement, config: any, plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const role = config.role || "user";
	const isSystem = role === "system";

	const header = container.createDiv({ cls: "iter-block-header" });
	const info = header.createDiv({ cls: "iter-info" });

	const roleContainer = info.createDiv({cls: "iter-role-container"})

	if (isSystem) {
		const span = roleContainer.createSpan({
			cls: `iter-role iter-role-system`
		});
		setIcon(span, "shield");
	} else {
		const roleToggle = roleContainer.createEl("button", {
			cls: `iter-role iter-role-${role} clickable-icon`
		});

		const newRole = role === "user" ? "assistant" : "user";

		const iconName = role === "user" ? "user" : "bot";
		setIcon(roleToggle, iconName);
		roleToggle.setAttr("aria-label", `Switch to ${newRole}`);

		roleToggle.addEventListener("click", async () => {
			await toggleRoleInFile(plugin, ctx, newRole, el);
		});
	}

	roleContainer.createSpan({
		cls: `iter-role-label`,
		text: role.toUpperCase()
	})

	const spacerChar = "/"
	if (config.model) {
		info.createSpan({ text: spacerChar, cls: "iter-spacer" });
		info.createSpan({ text: config.model, cls: "iter-model-info iter-metadata" });
	}

	const controls = header.createDiv({ cls: "iter-controls" });

	const trimBtn = controls.createEl("button", {
		cls: "iter-trim-btn clickable-icon"
	});
	setIcon(trimBtn, "scissors");
	trimBtn.setAttr("aria-label", "Trim blank lines");
	trimBtn.addEventListener("click", async () => {
		await trimSectionInFile(plugin, ctx, el);
	});

	const deleteBtn = controls.createEl("button", {
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
