import {
	EditorView,
	WidgetType,
	Decoration,
	DecorationSet,
	ViewPlugin,
	ViewUpdate,
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

		if (text === "---iter-begin---") {
			inRegion = true;
			builder.add(line.from, line.from, Decoration.line({ 
				attributes: { class: "iter-region-line iter-region-start" } 
			}));
			builder.add(line.to, line.to, Decoration.widget({
				widget: new RegionControlWidget(),
				side: 1
			}));
			continue;
		}

		if (inRegion && text === "---iter-end---") {
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

/**
 * Patcher to apply region classes to atomic blocks (embeds) like callouts, tables, and math
 * which are not rendered as standard lines.
 */
export const regionPatcher = ViewPlugin.fromClass(class {
	constructor(view: EditorView) {
		this.patch(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.patch(update.view);
		}
	}

	patch(view: EditorView) {
		const field = view.state.field(regionField);
		const embedBlocks = view.dom.querySelectorAll('.cm-embed-block');
		
		embedBlocks.forEach(block => {
			try {
				const pos = view.posAtDOM(block);
				let inRegion = false;
				
				field.between(pos, pos, (from, to, value) => {
					const cls = (value.spec as any).attributes?.class;
					if (cls && cls.includes('iter-region-line')) {
						inRegion = true;
					}
				});

				if (inRegion) {
					block.classList.add('iter-region-line');
					// If it's the start or end line, we might want those classes too, 
					// but usually embeds are in the middle.
				} else {
					block.classList.remove('iter-region-line');
				}
			} catch (e) {
				// posAtDOM can fail if the element is being unmounted
			}
		});
	}
});