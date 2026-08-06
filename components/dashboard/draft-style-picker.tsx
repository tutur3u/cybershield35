import { Check } from "lucide-react";

type StyleOption = {
	description: string;
	label: string;
};

export function DraftStylePicker(props: {
	defaultValue: string;
	helper: string;
	label: string;
	name: string;
	onChange: (value: string) => void;
	options: readonly StyleOption[];
	value: string;
}) {
	return (
		<fieldset className="min-w-0">
			<legend className="sr-only">{props.label}</legend>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<span className="text-[12px] font-extrabold text-[var(--foreground)]">
					{props.label}
				</span>
				<span className="text-[10px] font-semibold text-[var(--muted)]">
					{props.helper}
				</span>
			</div>
			<div className="mt-2 grid gap-2 sm:grid-cols-2">
				{props.options.map((option) => {
					const selected = option.label === props.value;
					return (
						<label
							key={option.label}
							className={`relative min-w-0 cursor-pointer rounded-lg border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand)] ${
								selected
									? "border-[var(--brand)] bg-[var(--accent-soft)] shadow-[0_0_0_1px_var(--brand)]"
									: "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-soft)]"
							}`}
						>
							<input
								type="radio"
								name={props.name}
								value={option.label}
								checked={selected}
								onChange={(event) => props.onChange(event.target.value)}
								className="sr-only"
							/>
							<span className="flex items-start gap-2">
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold text-[var(--foreground)]">
										{option.label}
										{option.label === props.defaultValue ? (
											<span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide text-[var(--brand)] uppercase">
												Mặc định
											</span>
										) : null}
									</span>
									<span className="mt-1 block text-[10px] font-medium leading-4 text-[var(--muted-strong)]">
										{option.description}
									</span>
								</span>
								<span
									aria-hidden="true"
									className={`grid size-5 shrink-0 place-items-center rounded-full border ${
										selected
											? "border-[var(--brand)] bg-[var(--accent-fill)] text-white"
											: "border-[var(--border-strong)] text-transparent"
									}`}
								>
									<Check size={12} strokeWidth={3} />
								</span>
							</span>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}
