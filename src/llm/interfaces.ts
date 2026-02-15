export interface ChatImage {
	data: string; // base64 data
	mimeType: string;
}

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
	images?: ChatImage[];
}

export interface LLMProvider {
	id: string;
	name: string;
	generateStream(messages: ChatMessage[], model: string, temperature: number): AsyncGenerator<string, void, unknown>;
	listModels(): Promise<string[]>;
}
