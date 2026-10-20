import { useEffect, useState } from 'react';
import type { Exercise, Prescription } from '@/domain/types';
import { prescriptionIssues } from '@/domain/validation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Field } from './common';

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s));
const str = (n: number | null | undefined) => (n == null ? '' : String(n));

/** Edit the target sets/reps/time/distance for an exercise in a workout. */
export function PrescriptionDialog({
  open,
  onOpenChange,
  exercise,
  value,
  onSave
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  exercise: Exercise | undefined;
  value: Prescription;
  onSave: (p: Prescription) => void;
}) {
  const [sets, setSets] = useState('');
  const [repsMin, setRepsMin] = useState('');
  const [repsMax, setRepsMax] = useState('');
  const [dur, setDur] = useState('');
  const [durMax, setDurMax] = useState('');
  const [dist, setDist] = useState('');
  const [rest, setRest] = useState('');
  const [perSide, setPerSide] = useState(false);
  const [optional, setOptional] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSets(str(value.sets));
    setRepsMin(str(value.repsMin));
    setRepsMax(str(value.repsMax));
    setDur(str(value.durationSec));
    setDurMax(str(value.durationMaxSec));
    setDist(str(value.distanceM));
    setRest(str(value.restSeconds));
    setPerSide(!!value.perSide);
    setOptional(!!value.optional);
    setNote(value.note ?? '');
    setErrors([]);
  }, [open, value]);

  const type = exercise?.progressionType;
  const showReps = type !== 'conditioning' && type !== 'timed_hold' && type !== 'sprint';
  const showDuration = type === 'conditioning' || type === 'timed_hold' || type === 'mobility';
  const showDistance = type === 'sprint' || type === 'agility';

  const save = () => {
    const p: Prescription = {
      sets: Number(sets),
      repsMin: showReps ? num(repsMin) : null,
      repsMax: showReps ? (num(repsMax) ?? num(repsMin)) : null,
      durationSec: showDuration ? num(dur) : null,
      durationMaxSec: showDuration ? num(durMax) : null,
      distanceM: showDistance ? num(dist) : null,
      restSeconds: num(rest),
      perSide,
      optional,
      note: note.trim() || undefined
    };
    const issues = prescriptionIssues(p, 'Target');
    if (issues.length) return setErrors(issues);
    onSave(p);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit target</DialogTitle>
          <DialogDescription>{exercise?.name}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sets" htmlFor="rx-sets">
            <Input id="rx-sets" type="number" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <Field label="Rest (s)" htmlFor="rx-rest" hint={exercise ? `Default ${exercise.restSeconds} s` : undefined}>
            <Input id="rx-rest" type="number" inputMode="numeric" value={rest} placeholder={exercise ? String(exercise.restSeconds) : ''} onChange={(e) => setRest(e.target.value)} />
          </Field>
          {showReps && (
            <>
              <Field label="Reps (min)" htmlFor="rx-rmin">
                <Input id="rx-rmin" type="number" inputMode="numeric" value={repsMin} onChange={(e) => setRepsMin(e.target.value)} />
              </Field>
              <Field label="Reps (max)" htmlFor="rx-rmax" hint="Same as min for a fixed target">
                <Input id="rx-rmax" type="number" inputMode="numeric" value={repsMax} onChange={(e) => setRepsMax(e.target.value)} />
              </Field>
            </>
          )}
          {showDuration && (
            <>
              <Field label="Duration (s)" htmlFor="rx-dur">
                <Input id="rx-dur" type="number" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} />
              </Field>
              <Field label="Up to (s)" htmlFor="rx-durmax" hint="Optional range">
                <Input id="rx-durmax" type="number" inputMode="numeric" value={durMax} onChange={(e) => setDurMax(e.target.value)} />
              </Field>
            </>
          )}
          {showDistance && (
            <Field label="Distance (m)" htmlFor="rx-dist">
              <Input id="rx-dist" type="number" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} />
            </Field>
          )}
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="text-sm">Per side / per leg</span>
          <Switch checked={perSide} onCheckedChange={setPerSide} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span className="text-sm">Optional exercise</span>
          <Switch checked={optional} onCheckedChange={setOptional} />
        </label>
        <Field label="Coaching note" htmlFor="rx-note">
          <Input id="rx-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 3-second lowering" />
        </Field>
        {errors.length > 0 && (
          <ul className="text-sm text-danger" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save target</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
