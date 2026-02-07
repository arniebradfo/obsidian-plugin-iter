import { parseYaml, requestUrl, TFile, App } from "obsidian";
import MyPlugin from "./main";

export async function executeChat(plugin: MyPlugin, file: TFile) {
	const buttons = document.querySelectorAll(".iter-footer-btn");
	buttons.forEach(btn => {
		if (btn instanceof HTMLButtonElement) {
			btn.innerText = "Thinking...";
			btn.disabled = true;
		}
	});

	try {
		const content = await plugin.app.vault.read(file);
		const messages = parseChatContent(content);
		
		const cache = plugin.app.metadataCache.getFileCache(file);
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
		
		// Simply append to the end of the file
		const newContent = content.trim() + `\n\n\`\`\`iter\nrole: assistant\n\`\`\`\n${aiText}\n\n\`\`\`iter\nrole: user\n\`\`\`\n`;

		await plugin.app.vault.modify(file, newContent);
	} finally {
		buttons.forEach(btn => {
			if (btn instanceof HTMLButtonElement) {
				btn.innerText = "Submit to AI";
				btn.disabled = false;
			}
		});
	}
}

export function parseChatContent(content: string) {
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

export function isChatFile(app: App, filePath: string): boolean {
	const cache = app.metadataCache.getCache(filePath);
	return !!cache?.frontmatter?.["iter-chat"];
}