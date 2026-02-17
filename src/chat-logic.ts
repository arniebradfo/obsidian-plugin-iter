import { parseYaml, TFile, App, MarkdownView, Notice, arrayBufferToBase64, requestUrl } from "obsidian";
import MyPlugin from "./main";
import { ChatMessage, LLMProvider, ChatImage } from "./llm/interfaces";
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

export async function executeChat(plugin: MyPlugin, file: TFile, selectedModel: string, temperature: number) {
	const submitButtons = document.querySelectorAll(".turn-submit-btn");
	const allButtons = document.querySelectorAll(".turn-footer-btn");

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
		const messages = await parseChatContent(plugin.app, content);
		
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
		const stream = provider.generateStream(messages, actualModel, temperature);

		let isFirstToken = true;

		// Stream the content
		for await (const chunk of stream) {
			if (isFirstToken) {
				// Append the assistant start block ONLY on first token
				const assistantStart = `\n\n\`\`\`turn\nrole: assistant\nmodel: ${selectedModel}\ntemp: ${temperature}\n\`\`\`\n`;
				if (editor) {
					editor.replaceRange(assistantStart, { line: editor.lineCount(), ch: 0 });
				} else {
					await plugin.app.vault.append(file, assistantStart);
				}
				isFirstToken = false;
			}

			if (editor) {
				const lineCount = editor.lineCount();
				const lastLine = editor.getLine(lineCount - 1);
				editor.replaceRange(chunk, { line: lineCount - 1, ch: lastLine.length });
			}
		}

		if (!isFirstToken) {
			// Append the trailing user block ONLY if we actually got a response
			const userEnd = `\n\n\`\`\`turn\nrole: user\n\`\`\`\n`;
			if (editor) {
				editor.replaceRange(userEnd, { line: editor.lineCount(), ch: 0 });
				editor.setCursor({ line: editor.lineCount(), ch: 0 });
			} else {
				await plugin.app.vault.append(file, userEnd);
			}

			// Handle Auto-Rename after second assistant message
			const assistantMessageCount = messages.filter(m => m.role === "assistant").length;
			// assistantMessageCount is 1 if this was the second response (previous history had 1)
			if (plugin.settings.autoRename && assistantMessageCount === 1) {
				// Only rename if it matches the default format: "Chat - YYYY-MM-DD N"
				const defaultPattern = /^Chat - \d{4}-\d{2}-\d{2} \d+$/;
				const currentName = file.basename;
				if (defaultPattern.test(currentName)) {
					await handleAutoRename(plugin, file, messages, provider, actualModel);
				}
			}
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

export async function handleAutoRename(plugin: MyPlugin, file: TFile, history: ChatMessage[], provider: LLMProvider, model: string) {
	// Add a request for a 6-word summary
	const summaryRequest: ChatMessage = {
		role: "user",
		content: "Please provide a very brief summary of this conversation in about 6 words or less. Do not include any other text, just the summary. No quotes."
	};

	try {
		const stream = provider.generateStream([...history, summaryRequest], model, 0.3);
		let summary = "";
		for await (const chunk of stream) {
			summary += chunk;
		}

		summary = summary.trim()
			.replace(/[\\/:*?"<>|]/g, "") // Sanitize for filename
			.replace(/\n/g, " ")
			.slice(0, 100); // Reasonable limit

		if (summary) {
			const newName = `Chat - ${summary}.md`;
			const folderPath = file.parent?.path || "";
			const newPath = folderPath === "" ? newName : `${folderPath}/${newName}`;
			
			// Check if file exists to avoid conflict
			if (!(await plugin.app.vault.adapter.exists(newPath))) {
				await plugin.app.fileManager.renameFile(file, newPath);
			}
		}
	} catch (e) {
		console.error("Auto-rename failed", e);
	}
}

export async function parseChatContent(app: App, content: string): Promise<ChatMessage[]> {
	const messages: ChatMessage[] = [];
	const parts = content.split(/```turn[\s\S]*?```/);
	const blocks = content.match(/```turn[\s\S]*?```/g) || [];

	for (let i = 0; i < parts.length; i++) {
		const text = parts[i] || "";
		const block = blocks[i - 1];
		if (!block) continue;
		
		const yaml = block.replace(/```turn|```/g, "").trim();
		const config = parseYaml(yaml) || {};
		
		if (config.role) {
			const images = await extractImages(app, text);
			const trimmedContent = text.trim();

			// Only add message if it has content OR images
			if (trimmedContent !== "" || images.length > 0) {
				messages.push({
					role: config.role,
					content: trimmedContent,
					images: images.length > 0 ? images : undefined
				});
			}
		}
	}

	return messages;
}

async function extractImages(app: App, text: string): Promise<ChatImage[]> {
	const images: ChatImage[] = [];
	
	// 1. Internal Obsidian links: ![[image.png]]
	const internalRegex = /!\[\[(.*?)\]\]/g;
	let match;
	while ((match = internalRegex.exec(text)) !== null) {
		const link = match[1]?.split("|")[0]; // Handle aliases/sizing
		if (link) {
			const file = app.metadataCache.getFirstLinkpathDest(link, "");
			if (file instanceof TFile) {
				const data = await app.vault.readBinary(file);
				images.push({
					data: arrayBufferToBase64(data),
					mimeType: getMimeType(file.extension)
				});
			}
		}
	}

	// 2. Standard Markdown links with URLs: ![desc](https://...)
	const urlRegex = /!\[.*?\]\((https?:\/\/.*?)\)/g;
	while ((match = urlRegex.exec(text)) !== null) {
		const url = match[1];
		if (url) {
			try {
				const response = await requestUrl({ url: url });
				if (response.status === 200) {
					const contentType = response.headers["content-type"] || "image/png";
					if (contentType.startsWith("image/")) {
						images.push({
							data: arrayBufferToBase64(response.arrayBuffer),
							mimeType: contentType
						});
					}
				}
			} catch (e) {
				console.error(`Failed to fetch image from URL: ${url}`, e);
			}
		}
	}

	return images;
}

function getMimeType(extension: string): string {
	switch (extension.toLowerCase()) {
		case "png": return "image/png";
		case "jpg":
		case "jpeg": return "image/jpeg";
		case "gif": return "image/gif";
		case "webp": return "image/webp";
		default: return "image/png";
	}
}

export function hasTurnBlocks(content: string): boolean {
	return content.includes("```turn");
}

export async function trimAllMessages(plugin: MyPlugin, file: TFile) {
	const content = await plugin.app.vault.read(file);
	const lines = content.split("\n");
	const newLines: string[] = [];
	
	let i = 0;
	while (i < lines.length) {
		const line = lines[i]!;
		
		if (line.trim().startsWith("```turn")) {
			newLines.push(line);
			let nextBlockIdx = lines.length;
			for (let j = i + 1; j < lines.length; j++) {
				if (lines[j]?.trim().startsWith("```turn")) {
					nextBlockIdx = j;
					break;
				}
			}
			
			const messageLines = lines.slice(i + 1, nextBlockIdx);
			
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
