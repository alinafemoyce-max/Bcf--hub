'use client';

import { useState } from 'react';
import { Controller, useFormContext, useWatch, type FieldErrors } from 'react-hook-form';
import { Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceChips, Field, Input, Select, Textarea } from '@/components/ui/form';
import { catalogueEntry, COMMON_THICKNESSES, MATERIAL_CATALOGUE } from '@/lib/catalogue';
import {
  CUTTING_LABELS,
  CUTTING_REQUIREMENTS,
  GRAIN_DIRECTIONS,
  GRAIN_LABELS,
  MATERIAL_CATEGORIES,
  MATERIAL_CATEGORY_LABELS,
  thicknessRequired,
  type MaterialCategory
} from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { FormValues, ItemValues } from './types';

const CUSTOM = '__custom__';

export function ItemCard({
  index,
  total,
  onDuplicate,
  onRemove
}: {
  index: number;
  total: number;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { control, register, setValue, formState } = useFormContext<FormValues>();
  const errors = (formState.errors.items?.[index] ?? {}) as FieldErrors<ItemValues>;
  const item = useWatch({ control, name: `items.${index}` }) as ItemValues;
  const category = item?.materialCategory as MaterialCategory | '';
  const catalogue = category ? MATERIAL_CATALOGUE[category] : [];
  const inCatalogue = Boolean(category && item.materialDescription && catalogueEntry(category, item.materialDescription));
  const [customMode, setCustomMode] = useState(() => Boolean(item?.materialDescription) && !inCatalogue);
  const showCustom = category === 'other' || customMode;
  const thicknessChips = (category && catalogueEntry(category, item.materialDescription)?.thicknesses) || COMMON_THICKNESSES;
  const id = (f: string) => `items-${index}-${f}`;
  const err = (f: keyof ItemValues) => (errors[f] as { message?: string } | undefined)?.message;

  return (
    <section
      className="rounded-xl border border-line bg-white shadow-card"
      aria-labelledby={id('title')}
      data-testid={`item-${index}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h3 id={id('title')} className="flex items-center gap-2 text-[15px] font-semibold text-navy">
          <span className="grid size-7 place-items-center rounded-md bg-marine-50 text-[13px] font-bold text-marine-700">
            {index + 1}
          </span>
          Cutting item {index + 1}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onDuplicate} aria-label={`Duplicate item ${index + 1}`}>
            <Copy aria-hidden /> <span className="hidden sm:inline">Duplicate</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={total === 1}
            className="text-danger hover:bg-danger-50"
            aria-label={`Remove item ${index + 1}`}
          >
            <Trash2 aria-hidden /> <span className="hidden sm:inline">Remove</span>
          </Button>
        </div>
      </div>

      <div className="space-y-5 px-4 py-5 sm:px-5">
        <Field label="Material category" error={err('materialCategory')}>
          <Controller
            control={control}
            name={`items.${index}.materialCategory`}
            render={({ field }) => (
              <div ref={field.ref} tabIndex={-1} className="outline-none">
                <ChoiceChips
                  name="Material category"
                  invalid={Boolean(err('materialCategory'))}
                  options={MATERIAL_CATEGORIES.map((c) => ({ value: c, label: MATERIAL_CATEGORY_LABELS[c] }))}
                  value={field.value}
                  columns="grid-cols-2 sm:grid-cols-4"
                  onChange={(v) => {
                    const next = v as MaterialCategory;
                    field.onChange(next);
                    if (!catalogueEntry(next, item.materialDescription)) {
                      setValue(`items.${index}.materialDescription`, '');
                      setCustomMode(false);
                    }
                    if ((next === 'mdf' || next === 'laminate') && !item.grainDirection) {
                      setValue(`items.${index}.grainDirection`, 'not_applicable');
                    }
                  }}
                />
              </div>
            )}
          />
        </Field>

        <Field
          label="Material description"
          htmlFor={id('description')}
          error={err('materialDescription')}
          hint={category && category !== 'other' ? 'Choose from the sample catalogue, or select “Not listed” to describe it.' : undefined}
        >
          {category && category !== 'other' && (
            <Select
              id={showCustom ? undefined : id('description')}
              value={showCustom ? CUSTOM : item.materialDescription}
              aria-invalid={Boolean(err('materialDescription')) && !showCustom}
              onChange={(e) => {
                if (e.target.value === CUSTOM) {
                  setCustomMode(true);
                  setValue(`items.${index}.materialDescription`, '', { shouldValidate: false });
                } else {
                  setCustomMode(false);
                  setValue(`items.${index}.materialDescription`, e.target.value, { shouldValidate: formState.isSubmitted });
                }
              }}
              className={showCustom ? 'mb-2' : undefined}
            >
              <option value="" disabled>
                Select material…
              </option>
              {catalogue.map((c) => (
                <option key={c.description} value={c.description}>
                  {c.description}
                </option>
              ))}
              <option value={CUSTOM}>Not listed — describe it</option>
            </Select>
          )}
          {!category && (
            <p className="rounded-lg border border-dashed border-line-strong px-3.5 py-3 text-sm text-muted">
              Choose a material category first.
            </p>
          )}
          {category && showCustom && (
            <Input
              id={id('description')}
              placeholder={category === 'other' ? 'e.g. Foam-core panel' : 'e.g. Oak-faced board'}
              autoComplete="off"
              aria-invalid={Boolean(err('materialDescription'))}
              {...register(`items.${index}.materialDescription`)}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Field
            label="Thickness"
            htmlFor={id('thickness')}
            error={err('thicknessMm')}
            optional={category === 'other'}
            className="col-span-2 sm:col-span-1"
          >
            <Input
              id={id('thickness')}
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              suffix="mm"
              placeholder="18"
              aria-invalid={Boolean(err('thicknessMm'))}
              {...register(`items.${index}.thicknessMm`)}
            />
            {category && thicknessRequired(category) && (
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Common thicknesses">
                {thicknessChips.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setValue(`items.${index}.thicknessMm`, String(t), { shouldValidate: formState.isSubmitted })}
                    className={cn(
                      'h-9 min-w-12 rounded-md border px-2.5 text-sm font-medium tabular',
                      String(t) === item.thicknessMm
                        ? 'border-marine bg-marine-50 text-navy'
                        : 'border-line-strong bg-white text-muted hover:text-ink'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Length" htmlFor={id('length')} error={err('lengthMm')}>
            <Input
              id={id('length')}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              suffix="mm"
              placeholder="800"
              aria-invalid={Boolean(err('lengthMm'))}
              {...register(`items.${index}.lengthMm`)}
            />
          </Field>
          <Field label="Width" htmlFor={id('width')} error={err('widthMm')}>
            <Input
              id={id('width')}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              suffix="mm"
              placeholder="400"
              aria-invalid={Boolean(err('widthMm'))}
              {...register(`items.${index}.widthMm`)}
            />
          </Field>
        </div>

        <Field label="Quantity" htmlFor={id('quantity')} error={err('quantity')} hint="Number of identical pieces at this size.">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Decrease quantity"
              onClick={() => {
                const q = Math.max(1, (Number.parseInt(item.quantity, 10) || 1) - 1);
                setValue(`items.${index}.quantity`, String(q), { shouldValidate: formState.isSubmitted });
              }}
            >
              <Minus />
            </Button>
            <Input
              id={id('quantity')}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              className="w-24 text-center text-lg font-semibold tabular"
              aria-invalid={Boolean(err('quantity'))}
              {...register(`items.${index}.quantity`)}
            />
            <Button
              variant="secondary"
              size="icon"
              aria-label="Increase quantity"
              onClick={() => {
                const q = (Number.parseInt(item.quantity, 10) || 0) + 1;
                setValue(`items.${index}.quantity`, String(q), { shouldValidate: formState.isSubmitted });
              }}
            >
              <Plus />
            </Button>
          </div>
        </Field>

        <Field label="Grain direction" optional error={err('grainDirection')}>
          <Controller
            control={control}
            name={`items.${index}.grainDirection`}
            render={({ field }) => (
              <ChoiceChips
                name="Grain direction"
                options={GRAIN_DIRECTIONS.map((g) => ({ value: g, label: GRAIN_LABELS[g] }))}
                value={field.value}
                onChange={field.onChange}
                columns="grid-cols-1 min-[420px]:grid-cols-3"
                allowDeselect
              />
            )}
          />
        </Field>

        <Field label="Cutting / machining requirements" error={err('cuttingRequirements')} hint="Select all that apply.">
          <Controller
            control={control}
            name={`items.${index}.cuttingRequirements`}
            render={({ field }) => (
              <div ref={field.ref} tabIndex={-1} className="outline-none">
                <ChoiceChips
                  name="Cutting requirements"
                  multiple
                  invalid={Boolean(err('cuttingRequirements'))}
                  options={CUTTING_REQUIREMENTS.map((c) => ({ value: c, label: CUTTING_LABELS[c] }))}
                  value={field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </Field>

        {item?.cuttingRequirements?.includes('other') && (
          <Field label="Describe the other requirement" htmlFor={id('cuttingOther')} error={err('cuttingOther')}>
            <Input
              id={id('cuttingOther')}
              placeholder="e.g. 45° bevel on one long edge"
              aria-invalid={Boolean(err('cuttingOther'))}
              {...register(`items.${index}.cuttingOther`)}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
          <Field
            label="Drawing or reference"
            htmlFor={id('drawing')}
            optional
            error={err('drawingReference')}
            hint="Drawing number or identifier."
          >
            <Input id={id('drawing')} placeholder="e.g. DRG-0412" autoComplete="off" {...register(`items.${index}.drawingReference`)} />
          </Field>
          <Field label="Additional specifications" htmlFor={id('notes')} optional error={err('notes')}>
            <Textarea
              id={id('notes')}
              rows={2}
              className="min-h-12"
              placeholder="Edge details, hole positions, labelling…"
              {...register(`items.${index}.notes`)}
            />
          </Field>
        </div>
      </div>
    </section>
  );
}
