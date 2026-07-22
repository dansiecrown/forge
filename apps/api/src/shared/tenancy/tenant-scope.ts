/** Required, non-optional scope object for every tenant-owned repository
 * query, per docs/project-structure.md §4: "Repository methods require
 * scope objects rather than optional organization arguments." */
export interface TenantScope {
  organizationId: string;
}
