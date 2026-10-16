import { useId } from 'react';
import { SECTORS } from '../data/catalog';
import { allCareers } from '../lib/data';

/** Native select grouped by sector – uses the iPhone's built-in picker. */
export function CareerPicker({ label, value = '', onPick, allowNone, exclude }: { label: string; value?: string; onPick: (slug: string) => void; allowNone?: string; exclude?: string }) {
  const id = useId();
  const careers = allCareers().filter((c) => c.slug !== exclude);
  return (
    <div className="field">
      <label className="field-label small" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onPick(e.target.value)}>
        {allowNone !== undefined ? <option value="">{allowNone}</option> : <option value="" disabled>Choose a career…</option>}
        {SECTORS.map((s) => {
          const list = careers.filter((c) => c.cat.sector === s.id).sort((a, b) => a.title.localeCompare(b.title));
          return list.length ? (
            <optgroup key={s.id} label={s.label}>
              {list.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}
