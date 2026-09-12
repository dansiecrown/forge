import { Fragment } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  /** Omitted for the current page — the last item is always plain text. */
  to?: string;
}

/** Full parent-chain navigation (Organization / Academy / Fellowship /
 * Cohort), replacing the single-level "ParentList / slug" pattern
 * `AdminPageHeader`'s `description` prop used ad hoc before. Pass as that
 * same `description` prop. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
      {items.map((item, index) => (
        <Fragment key={`${item.label}-${index}`}>
          {index > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
          ) : null}
          {item.to ? (
            <Link to={item.to} className="text-brand hover:underline">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
