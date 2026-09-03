import { Label } from '@/components/ui/label';

interface PermissionSummary {
  id: string;
  key: string;
  resource: string;
  action: string;
}

/** Groups the permission catalogue by `resource` — the create/edit role
 * forms' checkbox list. Takes the narrower shape `GET /roles/permission-
 * matrix` actually returns, not the full `Permission` contract type. */
export function PermissionCheckboxList({
  permissions,
  selected,
  onChange,
  disabled,
}: {
  permissions: PermissionSummary[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const byResource = new Map<string, PermissionSummary[]>();
  for (const permission of permissions) {
    const list = byResource.get(permission.resource) ?? [];
    list.push(permission);
    byResource.set(permission.resource, list);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <Label>Permissions</Label>
      <div className="max-h-96 space-y-4 overflow-y-auto rounded-card border border-border bg-surface p-4">
        {Array.from(byResource.entries()).map(([resource, items]) => (
          <div key={resource}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {resource}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((permission) => (
                <label
                  key={permission.id}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(permission.id)}
                    onChange={() => toggle(permission.id)}
                    disabled={disabled}
                    className="size-4 rounded border-border"
                  />
                  {permission.key}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
