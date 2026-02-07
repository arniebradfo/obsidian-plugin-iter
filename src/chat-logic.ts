import { parseYaml, TFile, App, MarkdownView } from "obsidian";
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

		// We need the editor to do smooth streaming updates
		const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = activeView?.file?.path === file.path ? activeView.editor : null;

		const response = await fetch(`${plugin.settings.ollamaUrl}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: model,
				messages: messages,
				stream: true
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama error: ${response.statusText}. Ensure OLLAMA_ORIGINS is set.`);
		}

		// 1. Append the assistant start block
		const assistantStart = `\n\n\`\`\`iter\nrole: assistant\n\`\`\`\n`;
		if (editor) {
			editor.replaceRange(assistantStart, { line: editor.lineCount(), ch: 0 });
		} else {
			await plugin.app.vault.append(file, assistantStart);
		}

		// 2. Stream the content
		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		let fullAiText = "";

		if (reader) {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (!line.trim()) continue;
					try {
						const json = JSON.parse(line);
						if (json.message?.content) {
							const content = json.message.content;
							fullAiText += content;
							
							if (editor) {
								const lineCount = editor.lineCount();
								const lastLine = editor.getLine(lineCount - 1);
								editor.replaceRange(content, { line: lineCount - 1, ch: lastLine.length });
							}
						}
					} catch (e) {
						console.error("Error parsing chunk", line, e);
					}
				}
			}
		}

		// 3. Append the trailing user block
		const userEnd = `\n\n\`\`\`iter\nrole: user\n\`\`\`\n`;
		if (editor) {
			editor.replaceRange(userEnd, { line: editor.lineCount(), ch: 0 });
			// Move cursor to the end
			editor.setCursor({ line: editor.lineCount(), ch: 0 });
		} else {
			await plugin.app.vault.append(file, userEnd);
		}

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
