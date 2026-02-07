import { ItemView, WorkspaceLeaf, ButtonComponent, MarkdownRenderer, Component } from "obsidian";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection, highlightSpecialChars, Rect } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";

export const VIEW_TYPE_CHAT = "iter-chat-view";

interface Message {
	id: string;
	content: string;
	role: "user" | "assistant";
}

export class ChatView extends ItemView {
	messages: Message[] = [];
	contentContainer: HTMLElement;
	editors: Map<string, EditorView> = new Map();

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.messages = [
			{ id: "1", content: "Hello! This view uses **MarkdownRenderer** for display.", role: "assistant" },
			{ id: "2", content: "# It supports everything\n- Lists\n- [[Links]]\n- `Code blocks`\n- And more...", role: "user" }
		];
	}

	getViewType() {
		return VIEW_TYPE_CHAT;
	}

	getDisplayText() {
		return "Iter Chat";
	}

	async onOpen() {
		const container = this.contentEl;
		container.empty();
		container.addClass("iter-chat-container");

		const header = container.createDiv({ cls: "iter-chat-header" });
		header.createEl("h4", { text: "Iter Stack" });

		this.contentContainer = container.createDiv({ cls: "iter-chat-messages" });
		
		const footer = container.createDiv({ cls: "iter-chat-footer" });
		new ButtonComponent(footer)
			.setButtonText("Add Message")
			.onClick(() => {
				this.addMessage("", "user");
			});

		this.renderMessages();
	}

	addMessage(content: string, role: "user" | "assistant") {
		const id = Date.now().toString();
		this.messages.push({ id, content, role });
		this.renderMessages();
	}

	renderMessages() {
		this.contentContainer.empty();
		this.editors.forEach(view => view.destroy());
		this.editors.clear();
		
		this.messages.forEach((msg, index) => {
			const bubble = this.contentContainer.createDiv({ 
				cls: `iter-chat-bubble iter-chat-${msg.role}` 
			});

			const displayArea = bubble.createDiv({ cls: "iter-chat-display markdown-rendered" });
			const editArea = bubble.createDiv({ cls: "iter-chat-edit", attr: { style: "display: none;" } });

			// Initial Render
			MarkdownRenderer.renderMarkdown(msg.content, displayArea, "", this);

			displayArea.addEventListener("click", () => {
				displayArea.style.display = "none";
				editArea.style.display = "block";
				this.mountEditor(editArea, msg, (newContent) => {
					msg.content = newContent;
					// Update display area live if wanted, or on blur
				}, () => {
					// On Blur
					displayArea.style.display = "block";
					editArea.style.display = "none";
					displayArea.empty();
					MarkdownRenderer.renderMarkdown(msg.content, displayArea, "", this);
				});
			});

			const controls = bubble.createDiv({ cls: "iter-chat-bubble-controls" });
			new ButtonComponent(controls)
				.setIcon("trash")
				.setTooltip("Delete message")
				.onClick(() => {
					this.messages.splice(index, 1);
					this.renderMessages();
				});
		});
	}

	mountEditor(parent: HTMLElement, msg: Message, onChange: (val: string) => void, onBlur: () => void) {
		const state = EditorState.create({
			doc: msg.content,
			extensions: [
				history(),
				drawSelection(),
				highlightSpecialChars(),
				indentOnInput(),
				bracketMatching(),
				closeBrackets(),
				syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
				markdown({ base: markdownLanguage }),
				keymap.of([
					...defaultKeymap,
					...historyKeymap,
					...closeBracketsKeymap,
				]),
				EditorView.lineWrapping,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						onChange(update.state.doc.toString());
					}
				}),
				EditorView.domEventHandlers({
					blur: (event, view) => {
						onBlur();
					}
				})
			]
		});

		const view = new EditorView({
			state,
			parent: parent
		});

		this.editors.set(msg.id, view);
		view.focus();
	}

	async onClose() {
		this.editors.forEach(view => view.destroy());
		this.editors.clear();
	}
}
