import { MarkdownPostProcessorContext, parseYaml, requestUrl, Notice } from "obsidian";
import MyPlugin from "./main";

export function registerCodeBlock(plugin: MyPlugin) {
	plugin.registerMarkdownCodeBlockProcessor(
		"iter",
		async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const activeFile = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
			if (!activeFile) return;

			// Check if file is a chat file via frontmatter
			const cache = plugin.app.metadataCache.getCache(ctx.sourcePath);
			if (!cache?.frontmatter?.["iter-chat"]) {
				const pre = el.createEl("pre");
				pre.createEl("code", { text: "```iter\n" + source + "\n```" });
				return;
			}

			const config = parseYaml(source) || {};
			const container = el.createDiv({ cls: "iter-chat-block" });

			if (config.type === "submit") {
				renderSubmitBlock(container, plugin, ctx);
			} else {
				renderMetadataBlock(container, config, plugin, ctx, el);
			}
		}
	);
}

function renderMetadataBlock(container: HTMLElement, config: any, plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	container.addClass("iter-metadata-block");
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

async function deleteSectionFromFile(plugin: MyPlugin, ctx: MarkdownPostProcessorContext, el: HTMLElement) {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!file || !("extension" in file)) return;

	const content = await plugin.app.vault.read(file as any);
	const lines = content.split("\n");
	
	const section = ctx.getSectionInfo(el);
	if (!section) return;

	// We want to delete from lineStart until the next ```iter block starts
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

function renderSubmitBlock(container: HTMLElement, plugin: MyPlugin, ctx: MarkdownPostProcessorContext) {
	container.addClass("iter-submit-block");
	const btn = container.createEl("button", { text: "Send to AI", cls: "iter-submit-btn" });
	
	btn.addEventListener("click", async () => {
		btn.disabled = true;
		btn.innerText = "Thinking...";
		try {
			await executeChat(plugin, ctx);
		} catch (e) {
			new Notice("Error: " + (e instanceof Error ? e.message : String(e)));
		} finally {
			btn.disabled = false;
			btn.innerText = "Send to AI";
		}
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

async function executeChat(plugin: MyPlugin, ctx: MarkdownPostProcessorContext) {
	const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!file || !("extension" in file)) return;

	const content = await plugin.app.vault.read(file as any);
	const messages = parseChatContent(content);
	
	const cache = plugin.app.metadataCache.getCache(ctx.sourcePath);
	const model = cache?.frontmatter?.model || plugin.settings.defaultModel;

	const response = await requestUrl({
		url: `${plugin.settings.ollamaUrl}/api/chat`,
		method: "POST",
		body: JSON.stringify({
			model: model,
			messages: messages,
			stream: false
		})
	});

	const aiText = response.json.message.content;
	
	// Append the new message
	const newContent = content.replace(/```iter\s*type: submit\s*```/, `\`\`\`iter
role: assistant
\`\`\`
${aiText}

\`\`\`iter
role: user
\`\`\`

\`\`\`iter
type: submit
\`\`\`
`);

	await plugin.app.vault.modify(file as any, newContent);
}

function parseChatContent(content: string) {
	const messages: any[] = [];
	const parts = content.split(/```iter[\s\S]*?```/);
	const blocks = content.match(/```iter[\s\S]*?```/g) || [];

	parts.forEach((text, i) => {
		const block = blocks[i-1];
		if (!block) return;
		
		const yaml = block.replace(/```iter|```/g, "").trim();
		const config = parseYaml(yaml) || {};
		
		if (config.role) {
			messages.push({
				role: config.role,
				content: text.trim()
			});
		}
	});

	return messages;
}
