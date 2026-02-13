import { parseYaml, TFile, App, MarkdownView, Notice } from "obsidian";
import MyPlugin from "./main";
import { ChatMessage, LLMProvider } from "./llm/interfaces";
import { OllamaProvider } from "./llm/ollama";
import { OpenAIProvider } from "./llm/openai";
import { GeminiProvider } from "./llm/gemini";
import { AnthropicProvider } from "./llm/anthropic";
import { AzureOpenAIProvider } from "./llm/azure";

export function getProvider(plugin: MyPlugin, modelString: string): { provider: LLMProvider, actualModel: string } {
	let providerId = 'ollama';
	let actualModel = modelString;

	if (modelString.includes('/')) {
		const parts = modelString.split('/');
		providerId = parts[0] || 'ollama';
		actualModel = parts[1] || modelString;
	}

	switch (providerId) {
		case 'ollama':
			return { provider: new OllamaProvider(plugin.settings), actualModel };
		case 'openai':
			return { provider: new OpenAIProvider(plugin.app, plugin.settings), actualModel };
		case 'gemini':
			return { provider: new GeminiProvider(plugin.app, plugin.settings), actualModel };
		case 'anthropic':
			return { provider: new AnthropicProvider(plugin.app, plugin.settings), actualModel };
		case 'azure':
			return { provider: new AzureOpenAIProvider(plugin.app, plugin.settings), actualModel };
		default:
			throw new Error(`Unknown provider: ${providerId}`);
	}
}

export async function executeChat(plugin: MyPlugin, file: TFile, selectedModel: string) {
	const submitButtons = document.querySelectorAll(".iter-submit-btn");
	const allButtons = document.querySelectorAll(".iter-footer-btn");

	submitButtons.forEach(btn => {
		if (btn instanceof HTMLButtonElement) {
			btn.innerText = "Thinking...";
		}
	});

	allButtons.forEach(btn => {
		if (btn instanceof HTMLButtonElement) {
			btn.disabled = true;
		}
	});

	try {
		const content = await plugin.app.vault.read(file);
		const messages = parseChatContent(content);
		
		const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const editor = activeView?.file?.path === file.path ? activeView.editor : null;

		if (editor && activeView) {
			const lineCount = editor.lineCount();
			editor.setCursor({ line: lineCount, ch: 0 });
			editor.focus();
			
			// Direct scroll to bottom of the CM6 scroller
			const scroller = activeView.contentEl.querySelector('.cm-scroller');
			if (scroller) {
				scroller.scrollTop = scroller.scrollHeight;
			}
		}

		const { provider, actualModel } = getProvider(plugin, selectedModel);
		const stream = provider.generateStream(messages, actualModel);

		// 1. Append the assistant start block with the model recorded
		const assistantStart = `\n\n\`\`\`iter\nrole: assistant\nmodel: ${selectedModel}\n\`\`\`\n`;
		if (editor) {
			editor.replaceRange(assistantStart, { line: editor.lineCount(), ch: 0 });
		} else {
			await plugin.app.vault.append(file, assistantStart);
		}

		// 2. Stream the content
		for await (const chunk of stream) {
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
		submitButtons.forEach(btn => {
			if (btn instanceof HTMLButtonElement) {
				btn.innerText = "Submit to AI";
			}
		});

		allButtons.forEach(btn => {
			if (btn instanceof HTMLButtonElement) {
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

export async function trimAllMessages(plugin: MyPlugin, file: TFile) {
	const content = await plugin.app.vault.read(file);
	const lines = content.split("\n");
	const newLines: string[] = [];
	
	let i = 0;
	while (i < lines.length) {
		const line = lines[i]!;
		
		if (line.trim().startsWith("```iter")) {
			newLines.push(line);
			// Find the start of the next block or end of file
			let nextBlockIdx = lines.length;
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j]?.trim().startsWith("```iter")) {
					nextBlockIdx = j;
					break;
				}
			}
			
			const messageLines = lines.slice(i + 1, nextBlockIdx);
			
			// Trim
			while (messageLines.length > 0 && messageLines[0]?.trim() === "") {
				messageLines.shift();
			}
			while (messageLines.length > 0 && messageLines[messageLines.length - 1]?.trim() === "") {
				messageLines.pop();
			}
			
			newLines.push(...messageLines);
			i = nextBlockIdx; 
		} else {
			newLines.push(line);
			i++;
		}
	}
	
	await plugin.app.vault.modify(file, newLines.join("\n"));
}
