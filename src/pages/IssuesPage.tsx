import { useMemo, useState } from 'react';
import { useData } from '../state/store';
import { useRouter } from '../state/router';
import { EmptyState, PageHeader, SearchBox, Segmented, SelectField, Sheet } from '../components/ui';
import { IssueRow } from '../components/IssueRow';
import { Icon } from '../components/Icon';
import { ISSUE_STATUSES, PRIORITIES, type Issue } from '../types';
import { comparePriority, isActive, isAwaiting, isDone, isOverdue } from '../lib/metrics';

type View = 'active' | 'overdue' | 'awaiting' | 'resolved' | 'archived' | 'all';
type Sort = 'followup' | 'newest' | 'oldest' | 'priority' | 'updated';

const VIEWS: { value: View; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'awaiting', label: 'Awaiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' }
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'followup', label: 'Next follow-up (soonest first)' },
  { value: 'priority', label: 'Priority (high first)' },
  { value: 'newest', label: 'Date raised (newest first)' },
  { value: 'oldest', label: 'Date raised (oldest first)' },
  { value: 'updated', label: 'Recently updated' }
];

const viewFilter: Record<View, (i: Issue) => boolean> = {
  active: isActive,
  overdue: (i) => isOverdue(i),
  awaiting: isAwaiting,
  resolved: (i) => isDone(i) && !i.archived,
  archived: (i) => i.archived,
  all: () => true
};

interface Filters {
  status: string;
  priority: string;
  department: string;
  category: string;
}
const NO_FILTERS: Filters = { status: '', priority: '', department: '', category: '' };

export function matchesSearch(i: Issue, q: string): boolean {
  if (!q) return true;
  const hay = [i.ref, i.title, i.description, i.department, i.category, i.managementResponse, i.actionOwner, i.resolutionNotes, i.status].join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function sortIssues(list: Issue[], sort: Sort): Issue[] {
  const copy = list.slice();
  switch (sort) {
    case 'followup':
      return copy.sort((a, b) => (a.nextFollowUp || '9999').localeCompare(b.nextFollowUp || '9999') || comparePriority(a, b));
    case 'priority':
      return copy.sort((a, b) => comparePriority(a, b) || (a.nextFollowUp || '9999').localeCompare(b.nextFollowUp || '9999'));
    case 'newest':
      return copy.sort((a, b) => b.dateRaised.localeCompare(a.dateRaised) || b.ref.localeCompare(a.ref));
    case 'oldest':
      return copy.sort((a, b) => a.dateRaised.localeCompare(b.dateRaised) || a.ref.localeCompare(b.ref));
    case 'updated':
      return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export function IssuesPage() {
  const { issues, settings } = useData();
  const router = useRouter();
  const view = (VIEWS.some((v) => v.value === router.query.get('view')) ? router.query.get('view') : 'active') as View;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('followup');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(NO_FILTERS);
  const [draftSort, setDraftSort] = useState<Sort>('followup');
  const [filterOpen, setFilterOpen] = useState(false);

  const setView = (v: View) => router.navigate(v === 'active' ? '/issues' : `/issues?view=${v}`, { replace: true });

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.value, issues.filter(viewFilter[v.value]).length])) as Record<View, number>, [issues]);

  const results = useMemo(() => {
    const filtered = issues.filter(
      (i) =>
        viewFilter[view](i) &&
        (!filters.status || i.status === filters.status) &&
        (!filters.priority || i.priority === filters.priority) &&
        (!filters.department || i.department === filters.department) &&
        (!filters.category || i.category === filters.category) &&
        matchesSearch(i, q.trim())
    );
    return sortIssues(filtered, sort);
  }, [issues, view, filters, q, sort]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const departments = [...new Set([...settings.departments, ...issues.map((i) => i.department)])].filter(Boolean);
  const categories = [...new Set([...settings.categories, ...issues.map((i) => i.category)])].filter(Boolean);

  const openFilters = () => {
    setDraftFilters(filters);
    setDraftSort(sort);
    setFilterOpen(true);
  };

  return (
    <div className="page">
      <PageHeader
        title="Issues"
        large
        subtitle={`${counts.active} active · ${counts.overdue} overdue`}
        actions={
          <button className="icon-btn icon-btn-primary" onClick={() => router.navigate('/issues/new')} aria-label="New issue">
            <Icon name="plus" size={22} />
          </button>
        }
      />
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="Search issues, IDs, responses…" />
        <button className={`icon-btn filter-btn ${activeFilterCount ? 'has-filters' : ''}`} onClick={openFilters} aria-label={`Filter and sort${activeFilterCount ? `, ${activeFilterCount} filters active` : ''}`}>
          <Icon name="filter" size={19} />
          {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
        </button>
      </div>
      <div className="scroll-x">
        <Segmented label="Issue views" value={view} onChange={setView} options={VIEWS.map((v) => ({ ...v, count: counts[v.value] }))} />
      </div>

      {activeFilterCount > 0 && (
        <div className="chips">
          {(Object.keys(filters) as (keyof Filters)[])
            .filter((k) => filters[k])
            .map((k) => (
              <button key={k} className="chip chip-active" onClick={() => setFilters({ ...filters, [k]: '' })} aria-label={`Remove filter ${filters[k]}`}>
                {filters[k]} <Icon name="close" size={13} />
              </button>
            ))}
          <button className="chip" onClick={() => setFilters(NO_FILTERS)}>
            Clear all
          </button>
        </div>
      )}

      <p className="result-count" aria-live="polite">
        {results.length} issue{results.length === 1 ? '' : 's'}
        {q && ` matching “${q}”`} · sorted by {SORTS.find((s) => s.value === sort)!.label.split(' (')[0].toLowerCase()}
      </p>

      {results.length ? (
        <div className="list">
          {results.map((i) => (
            <IssueRow key={i.id} issue={i} />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon="issues"
          title="No issues yet"
          text="Log the first issue raised by apprentices, or load demo data from More › Data & backup."
          action={
            <button className="btn btn-primary" onClick={() => router.navigate('/issues/new')}>
              <Icon name="plus" size={18} /> New issue
            </button>
          }
        />
      ) : (
        <EmptyState icon="search" title="Nothing matches" text="Try a different view, search term or filter." />
      )}

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter & sort"
        footer={
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setDraftFilters(NO_FILTERS)}>
              Reset
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setFilters(draftFilters);
                setSort(draftSort);
                setFilterOpen(false);
              }}
            >
              Apply
            </button>
          </div>
        }
      >
        <SelectField label="Sort by" value={draftSort} onChange={(v) => setDraftSort(v as Sort)} options={SORTS} />
        <SelectField label="Status" value={draftFilters.status} onChange={(v) => setDraftFilters({ ...draftFilters, status: v })} options={ISSUE_STATUSES} placeholder="Any status" />
        <SelectField label="Priority" value={draftFilters.priority} onChange={(v) => setDraftFilters({ ...draftFilters, priority: v })} options={PRIORITIES} placeholder="Any priority" />
        <SelectField label="Department or shed" value={draftFilters.department} onChange={(v) => setDraftFilters({ ...draftFilters, department: v })} options={departments} placeholder="Any department" />
        <SelectField label="Category" value={draftFilters.category} onChange={(v) => setDraftFilters({ ...draftFilters, category: v })} options={categories} placeholder="Any category" />
      </Sheet>
    </div>
  );
}
