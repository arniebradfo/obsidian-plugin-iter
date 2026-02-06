import {
	EditorView,
	WidgetType,
	Decoration,
	DecorationSet,
} from "@codemirror/view";
import { RangeSetBuilder, StateField, Transaction, Extension } from "@codemirror/state";

class ControlWidget extends WidgetType {
	constructor(readonly id: string) {
		super();
	}

	toDOM(view: EditorView): HTMLElement {
		const container = document.createElement("div");
		container.classList.add("iter-control-container");
		container.style.border = "1px solid var(--background-modifier-border)";
		container.style.borderRadius = "4px";
		container.style.padding = "10px";
		container.style.margin = "10px 0";
		container.style.display = "flex";
		container.style.alignItems = "center";
		container.style.gap = "10px";
		container.style.backgroundColor = "var(--background-secondary)";

		const label = container.createEl("span", {
			text: `Control [${this.id}]: `,
		});
		label.style.fontWeight = "bold";

		const input = container.createEl("input", {
			type: "text",
			placeholder: "Enter value...",
		});
		input.style.flex = "1";

		const button = container.createEl("button", {
			text: "Execute",
		});
		button.addEventListener("click", () => {
			console.log(`Executing control ${this.id} with value: ${input.value}`);
		});

		return container;
	}
}

function buildDecorations(state: any): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const content = state.doc.toString();
	const regex = /%%control:\s*(.*?)\s*%%/g;
	let match;

	while ((match = regex.exec(content)) !== null) {
		const start = match.index;
		const end = start + match[0].length;
		const controlId = (match[1] || "default").trim();

		builder.add(
			start,
			end,
			Decoration.replace({
				widget: new ControlWidget(controlId),
			})
		);
	}

	return builder.finish();
}

export const controlField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return buildDecorations(state);
	},
	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		if (transaction.docChanged) {
			return buildDecorations(transaction.state);
		}
		return oldState.map(transaction.changes);
	},
	provide(field): Extension {
		return EditorView.decorations.from(field);
	},
});