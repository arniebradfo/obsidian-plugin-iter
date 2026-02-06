import {
	EditorView,
	WidgetType,
	Decoration,
	DecorationSet,
} from "@codemirror/view";
import { RangeSetBuilder, StateField, Transaction, Extension } from "@codemirror/state";

class RegionControlWidget extends WidgetType {
	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.classList.add("iter-region-controls");
		
		const btnRun = span.createEl("button", { text: "▶ Run Region" });
		btnRun.addEventListener("click", () => {
			console.log("Region: Run clicked");
		});

		const btnClear = span.createEl("button", { text: "✕ Clear" });
		btnClear.addEventListener("click", () => {
			console.log("Region: Clear clicked");
		});

		return span;
	}
}

function getRegionDecorations(state: any): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const doc = state.doc;
	let inRegion = false;

	for (let i = 1; i <= doc.lines; i++) {
		const line = doc.line(i);
		const text = line.text.trim();

		if (text === "---iter") {
			inRegion = true;
			// Background and start styling
			builder.add(line.from, line.from, Decoration.line({ 
				attributes: { class: "iter-region-line iter-region-start" } 
			}));
			// Add control buttons as a widget at the end of the line
			builder.add(line.to, line.to, Decoration.widget({
				widget: new RegionControlWidget(),
				side: 1
			}));
			continue;
		}

		if (inRegion && text === "---") {
			inRegion = false;
			builder.add(line.from, line.from, Decoration.line({ 
				attributes: { class: "iter-region-line iter-region-end" } 
			}));
			continue;
		}

		if (inRegion) {
			builder.add(line.from, line.from, Decoration.line({ 
				attributes: { class: "iter-region-line" } 
			}));
		}
	}

	return builder.finish();
}

export const regionField = StateField.define<DecorationSet>({
	create(state): DecorationSet {
		return getRegionDecorations(state);
	},
	update(oldState: DecorationSet, transaction: Transaction): DecorationSet {
		if (transaction.docChanged) {
			return getRegionDecorations(transaction.state);
		}
		return oldState.map(transaction.changes);
	},
	provide(field): Extension {
		return EditorView.decorations.from(field);
	},
});
