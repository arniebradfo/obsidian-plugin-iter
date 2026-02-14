import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import MyPlugin from "./main";
import { getAllAvailableModels } from "./llm/model-suggest-helper";

export class ModelSuggest extends EditorSuggest<string> {
	constructor(app: App, private plugin: MyPlugin) {
		super(app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const trigger = "model: ";
		
		if (line.includes(trigger)) {
			const start = line.indexOf(trigger) + trigger.length;
			return {
				start: { line: cursor.line, ch: start },
				end: cursor,
				query: line.substring(start),
			};
		}
		return null;
	}

	async getSuggestions(context: EditorSuggestContext): Promise<string[]> {
		const allModels = await getAllAvailableModels(this.app, this.plugin);
		return allModels.filter(m => 
			m.toLowerCase().contains(context.query.toLowerCase())
		);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		if (this.context) {
			const { editor, start, end } = this.context;
			editor.replaceRange(value, start, end);
		}
	}
}
