import type { FC, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CREDIT_ROWS, FEATURE_GROUPS, RECOMMENDED_PLAN, rowIncludes, type FeatureRow, type PricingPlan } from "@/app/lib/pricing/catalogue";
import { PerCredit, ShortPrice } from "@/app/components/pricing/BillingInterval";

const Included: FC<{ value: boolean | null }> = ({ value }) =>
  value ? (
    <span className="inline-grid h-5 w-5 place-content-center rounded-full bg-secondary text-primary">
      <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="text-primary/25">
      <span aria-hidden>—</span>
      {value === false ? <span className="sr-only">Not included</span> : null}
    </span>
  );

/** A plan's cell: its own text when the row has one for it ("1 resume"), else a tick or a dash. */
const Cell: FC<{ row: FeatureRow; plan: PricingPlan }> = ({ row, plan }) => {
  const text = row.values?.[plan.key];
  if (text) return <span className="text-sm font-medium text-primary/75">{text}</span>;
  return <Included value={rowIncludes(row, plan.key)} />;
};

interface Row {
  label: string;
  note?: string;
  cell: (plan: PricingPlan) => ReactNode;
}

const featureRow = (row: FeatureRow): Row => ({ label: row.label, note: row.note, cell: (plan) => <Cell row={row} plan={plan} /> });

const LABEL = "sticky left-0 z-10 bg-white pl-6 pr-4 text-left align-middle";
const CELL = "px-3 py-4 text-center align-middle";
/** A hairline above every cell in the row. The table is border-separate so each cell carries its own. */
const RULED = "[&>*]:border-t [&>*]:border-primary/[0.08]";
/**
 * The recommended plan's column: a faint tint and a 1px rule down each side, drawn by every cell in
 * it (header, group titles and all) so the rules run unbroken from the top of the table to the
 * bottom. Each rule reaches 1px up to cover the hairline above its cell, and never down, so the last
 * row can't make the scroll box taller.
 */
const FEATURED = cn(
  "relative bg-secondary/10",
  "before:pointer-events-none before:absolute before:-top-px before:bottom-0 before:left-0 before:w-px before:bg-primary",
  "after:pointer-events-none after:absolute after:-top-px after:bottom-0 after:right-0 after:w-px after:bg-primary",
);

/**
 * Every feature against every plan, under the plan cards. Columns come from the
 * live catalogue, rows from CREDIT_ROWS and FEATURE_GROUPS. On a phone the table
 * scrolls inside its own box, with the feature names pinned to the left.
 */
const PlanComparison: FC<{ plans: PricingPlan[] }> = ({ plans }) => {
  const featured = (plan: PricingPlan) => plan.key === RECOMMENDED_PLAN && FEATURED;

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "Credits",
      rows: [
        {
          label: "Monthly credits",
          cell: (plan) => <span className="text-base font-semibold tabular-nums">{plan.monthlyCredits}</span>,
        },
        {
          label: "Price per credit",
          cell: (plan) => (
            <span className="text-sm text-primary/65 tabular-nums">
              <PerCredit plan={plan} free="Free" />
            </span>
          ),
        },
        ...CREDIT_ROWS.map(featureRow),
      ],
    },
    ...FEATURE_GROUPS.map((group) => ({ title: group.title, rows: group.rows.map(featureRow) })),
  ];

  return (
    <div className="mt-16 overflow-hidden rounded-[20px] border border-primary/15 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Compare plans</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(LABEL, "w-[34%] min-w-[220px] pb-5 pt-7 align-bottom text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/50")}>
                Compare plans
              </th>
              {plans.map((plan) => (
                <th key={plan.key} scope="col" className={cn("w-[16%] px-3 pb-5 pt-7 text-center align-bottom", featured(plan))}>
                  {plan.key === RECOMMENDED_PLAN ? (
                    <span className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
                      Recommended
                    </span>
                  ) : null}
                  <span className="block text-base font-bold">{plan.name}</span>
                  <span className="mt-0.5 block text-xs font-medium text-primary/50 tabular-nums">
                    <ShortPrice plan={plan} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {groups.map((group) => (
            <tbody key={group.title}>
              <tr>
                <th scope="rowgroup" className={cn(LABEL, "pb-3 pt-9 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/50")}>
                  {group.title}
                </th>
                {plans.map((plan) => (
                  <td key={plan.key} aria-hidden className={cn(featured(plan))} />
                ))}
              </tr>
              {group.rows.map((row) => (
                <tr key={row.label} className={RULED}>
                  <th scope="row" className={cn(LABEL, "py-4 font-normal")}>
                    <span className="block font-medium text-primary">{row.label}</span>
                    {row.note ? <span className="mt-0.5 block text-xs leading-snug text-primary/50">{row.note}</span> : null}
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.key} className={cn(CELL, featured(plan))}>
                      {row.cell(plan)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
};

export default PlanComparison;
