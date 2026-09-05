import { reviewDecisionUpdate } from './practical-task-submissions.repository';

describe('reviewDecisionUpdate', () => {
  it('maps approved to status: completed, leaving submittedAt untouched', () => {
    expect(reviewDecisionUpdate('approved')).toEqual({ status: 'completed' });
  });

  it('maps revision_requested to status: revision_requested and clears submittedAt — the gate re-lock', () => {
    expect(reviewDecisionUpdate('revision_requested')).toEqual({
      status: 'revision_requested',
      submittedAt: null,
    });
  });
});
