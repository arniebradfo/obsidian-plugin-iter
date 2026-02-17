import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from "obsidian";
import InlineAIChatNotebookPlugin from "./main";
import { getAllAvailableModels } from "./llm/model-suggest-helper";

export class ModelSuggest extends EditorSuggest<string> {
	constructor(app: App, private plugin: InlineAIChatNotebookPlugin) {
		super(app);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const sub = line.substring(0, cursor.ch);
		const match = sub.match(/model:\s*([^\s]*)$/);

		if (match && match[1] !== undefined) {
			return {
				start: { line: cursor.line, ch: match.index! + match[0].indexOf(match[1]) },
				end: cursor,
				query: match[1],
			};
		}
		return null;
	}

	async getSuggestions(context: EditorSuggestContext): Promise<string[]> {
		const allModels = await getAllAvailableModels(this.app, this.plugin);
		return allModels.filter((m) =>
			m.toLowerCase().includes(context.query.toLowerCase())
		);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		if (!this.context) return;
		this.context.editor.replaceRange(
			value,
			this.context.start,
			this.context.end
		);
	}
}
