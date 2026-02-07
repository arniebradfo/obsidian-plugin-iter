export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface LLMProvider {
	id: string;
	name: string;
	generateStream(messages: ChatMessage[], model: string): AsyncGenerator<string, void, unknown>;
}
