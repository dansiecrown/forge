import { useMemo, useState } from 'react';
import type { PublicCatalogFellowship } from '@forge/api-contract';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export interface CatalogSelection {
  cohortId: string | undefined;
  requestedLearningTrackId: string | undefined;
}

interface CatalogPickerProps {
  fellowships: PublicCatalogFellowship[];
  value: CatalogSelection;
  onChange: (selection: CatalogSelection) => void;
}

/** Shared fellowship -> cohort -> (optional) track picker, reused by the
 * anonymous `/apply` page and the authenticated `/portal/register` page —
 * see docs/adr/0010-cohort-applications.md. Only fellowships/cohorts the
 * public catalog endpoint already filtered to "open for applications" are
 * ever offered here. */
export function CatalogPicker({ fellowships, value, onChange }: CatalogPickerProps) {
  const [fellowshipId, setFellowshipId] = useState<string | undefined>(
    () => fellowships.find((f) => f.cohorts.some((c) => c.id === value.cohortId))?.id,
  );

  const selectedFellowship = useMemo(
    () => fellowships.find((f) => f.id === fellowshipId),
    [fellowships, fellowshipId],
  );

  if (fellowships.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No programmes are currently open for applications.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fellowship">Programme</Label>
        <Select
          id="fellowship"
          value={fellowshipId ?? ''}
          onChange={(e) => {
            const nextId = e.target.value || undefined;
            setFellowshipId(nextId);
            onChange({ cohortId: undefined, requestedLearningTrackId: undefined });
          }}
        >
          <option value="">Select a programme…</option>
          {fellowships.map((fellowship) => (
            <option key={fellowship.id} value={fellowship.id}>
              {fellowship.title} — {fellowship.academyName}
            </option>
          ))}
        </Select>
        {selectedFellowship?.summary ? (
          <p className="text-sm text-muted-foreground">{selectedFellowship.summary}</p>
        ) : null}
      </div>

      {selectedFellowship ? (
        <div className="space-y-1.5">
          <Label htmlFor="cohort">Cohort</Label>
          <Select
            id="cohort"
            value={value.cohortId ?? ''}
            onChange={(e) => onChange({ ...value, cohortId: e.target.value || undefined })}
          >
            <option value="">Select a cohort…</option>
            {selectedFellowship.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name} — starts {new Date(cohort.startsAt).toLocaleDateString()}
              </option>
            ))}
          </Select>
          {selectedFellowship.cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cohort is currently open for enrollment in this programme.
            </p>
          ) : null}
        </div>
      ) : null}

      {selectedFellowship && selectedFellowship.tracks.length > 1 ? (
        <div className="space-y-1.5">
          <Label htmlFor="track">Learning track (optional)</Label>
          <Select
            id="track"
            value={value.requestedLearningTrackId ?? ''}
            onChange={(e) =>
              onChange({ ...value, requestedLearningTrackId: e.target.value || undefined })
            }
          >
            <option value="">No preference</option>
            {selectedFellowship.tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name} ({track.difficulty})
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </div>
  );
}
