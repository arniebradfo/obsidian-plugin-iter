import { parseYaml, TFile, App, MarkdownView, Notice } from "obsidian";
import MyPlugin from "./main";
import { ChatMessage, LLMProvider } from "./llm/interfaces";
import { OllamaProvider } from "./llm/ollama";

export function getProvider(plugin: MyPlugin, providerType?: string): LLMProvider {
	const type = providerType || 'ollama'; // Default to ollama for now
	
	switch (type) {
		case 'ollama':
			return new OllamaProvider(plugin.settings);
		case 'openai':
		case 'anthropic':
		case 'gemini':
		case 'azure':
			throw new Error(`Provider '${type}' is not yet implemented.`);
		default:
			throw new Error(`Unknown provider: ${type}`);
	}
}

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
		const providerType = cache?.frontmatter?.provider;

		const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = activeView?.file?.path === file.path ? activeView.editor : null;

		const provider = getProvider(plugin, providerType);
		const stream = provider.generateStream(messages, model);

		// 1. Append the assistant start block
		const assistantStart = `\n\n\`\`\`iter\nrole: assistant\n\`\`\`\n`;
		if (editor) {
			editor.replaceRange(assistantStart, { line: editor.lineCount(), ch: 0 });
		} else {
			await plugin.app.vault.append(file, assistantStart);
		}

		// 2. Stream the content
		let fullAiText = "";
		for await (const chunk of stream) {
			fullAiText += chunk;
			if (editor) {
				const lineCount = editor.lineCount();
				const lastLine = editor.getLine(lineCount - 1);
				editor.replaceRange(chunk, { line: lineCount - 1, ch: lastLine.length });
			}
		}

		// 3. Append the trailing user block
		const userEnd = `\n\n\`\`\`iter\nrole: user\n\`\`\`\n`;
		if (editor) {
			editor.replaceRange(userEnd, { line: editor.lineCount(), ch: 0 });
			editor.setCursor({ line: editor.lineCount(), ch: 0 });
		} else {
			await plugin.app.vault.append(file, userEnd);
		}

	} catch (e) {
		new Notice("Chat Error: " + (e instanceof Error ? e.message : String(e)));
		console.error(e);
	} finally {
		buttons.forEach(btn => {
			if (btn instanceof HTMLButtonElement) {
				btn.innerText = "Submit to AI";
				btn.disabled = false;
			}
		});
	}
}

export function parseChatContent(content: string): ChatMessage[] {
	const messages: ChatMessage[] = [];
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