// Hand-authored contract for the resource-bookmark toggle (Milestone 5 —
// Student Experience). `PUT`/`DELETE` on the resource path, not the
// `actions/*` pattern — a bookmark is a plain idempotent toggle, not a
// state-machine transition.

export interface ResourceBookmark {
  resourceId: string;
}
