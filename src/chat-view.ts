import { ItemView, WorkspaceLeaf, TextAreaComponent, ButtonComponent } from "obsidian";

export const VIEW_TYPE_CHAT = "iter-chat-view";

interface Message {
	id: string;
	content: string;
	role: "user" | "assistant";
}

export class ChatView extends ItemView {
	messages: Message[] = [];
	contentContainer: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
		this.messages = [
			{ id: "1", content: "Hello! This is the Iter chat interface.", role: "assistant" },
			{ id: "2", content: "Each bubble is its own editable markdown area.", role: "user" }
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
		this.messages.push({
			id: Date.now().toString(),
			content,
			role
		});
		this.renderMessages();
	}

	renderMessages() {
		this.contentContainer.empty();
		
		this.messages.forEach((msg, index) => {
			const bubble = this.contentContainer.createDiv({ 
				cls: `iter-chat-bubble iter-chat-${msg.role}` 
			});

			const editorWrapper = bubble.createDiv({ cls: "iter-chat-editor-wrapper" });
			
			const textArea = new TextAreaComponent(editorWrapper)
				.setValue(msg.content)
				.setPlaceholder(msg.role === "user" ? "Type your message..." : "Assistant response...")
				.onChange((value) => {
					const m = this.messages[index];
					if (m) m.content = value;
					// Auto-resize
					textArea.inputEl.style.height = 'auto';
					textArea.inputEl.style.height = textArea.inputEl.scrollHeight + 'px';
				});

			// Initial resize
			setTimeout(() => {
				textArea.inputEl.style.height = 'auto';
				textArea.inputEl.style.height = textArea.inputEl.scrollHeight + 'px';
			}, 0);

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

	async onClose() {
		// Cleanup if needed
	}
}
