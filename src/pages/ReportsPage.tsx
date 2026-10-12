import { useMemo, useState } from 'react';
import { hasDemoData, useData } from '../state/store';
import { Link } from '../state/router';
import { useExport } from '../components/FileExport';
import { Card, EmptyState, PageHeader, Section, Segmented } from '../components/ui';
import { Icon } from '../components/Icon';
import { addDays, formatDate, formatMonthKey, todayISO } from '../lib/dates';
import { averageResolutionDays, countBy, isActive, isDone, isOverdue, monthlySummary, overdueDays, type CountRow } from '../lib/metrics';
import { buildReportPdf } from '../lib/pdf';
import { IS_PREVIEW } from '../lib/env';

type Period = 'all' | '90' | '365';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '365', label: '12 months' },
  { value: '90', label: '90 days' }
];

export function ReportsPage() {
  const data = useData();
  const { exportFile } = useExport();
  const [period, setPeriod] = useState<Period>('all');
  const today = todayISO();

  const issues = useMemo(() => (period === 'all' ? data.issues : data.issues.filter((i) => i.dateRaised >= addDays(today, -Number(period)))), [data.issues, period, today]);
  const open = issues.filter((i) => !isDone(i)).length;
  const resolved = issues.filter(isDone).length;
  const active = issues.filter(isActive).length;
  const overdue = issues.filter((i) => isOverdue(i, today)).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
  const avg = averageResolutionDays(issues);
  const byCategory = countBy(issues, 'category');
  const byDepartment = countBy(issues, 'department');
  const byStatus = countBy(issues, 'status');
  const monthly = monthlySummary(data.issues, data.feedback, data.meetings, data.updates, period === '90' ? 3 : 6, today);
  const periodLabel = PERIODS.find((p) => p.value === period)!.label;
  const demo = hasDemoData(data);

  const exportPdf = () =>
    exportFile(
      () =>
        buildReportPdf({
          generatedFor: `Period: ${periodLabel} · Generated ${formatDate(today)}`,
          summary: [
            ['Issues raised in period', String(issues.length)],
            ['Open (not resolved/closed)', String(open)],
            ['Active (open, not archived)', String(active)],
            ['Resolved or closed', String(resolved)],
            ['Overdue follow-ups', String(overdue.length)],
            ['Average resolution time', avg.average === null ? 'Not enough data' : `${avg.average} days (from ${avg.sample} resolved issue${avg.sample === 1 ? '' : 's'})`]
          ],
          byCategory,
          byDepartment,
          overdue,
          monthly: monthly.map((m) => ({ ...m, month: formatMonthKey(m.month) })),
          demo
        }),
      'Report PDF'
    );

  return (
    <div className="page report-page">
      <PageHeader
        title="Reports"
        back="/more"
        actions={
          IS_PREVIEW ? undefined : <>
            <button className="icon-btn" onClick={() => window.print()} aria-label="Print report">
              <Icon name="print" size={20} />
            </button>
            <button className="btn btn-secondary btn-sm" onClick={exportPdf}>
              <Icon name="file" size={16} /> PDF
            </button>
          </>
        }
      />
      <div className="page-intro">
        <h1>Representative report</h1>
        <p className="muted">
          Calculated only from records on this device · {periodLabel} · {formatDate(today)}
        </p>
        {demo && <p className="badge badge-demo print-show">Includes fictional demo data</p>}
      </div>
      <div className="no-print">
        <Segmented label="Report period" value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      {issues.length === 0 ? (
        <EmptyState icon="chart" title="No issues in this period" text="Reports appear once issues have been recorded." action={<Link to="/issues/new" className="btn btn-secondary">Log an issue</Link>} />
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi label="Issues raised" value={issues.length} />
            <Kpi label="Open" value={open} />
            <Kpi label="Resolved / closed" value={resolved} />
            <Kpi label="Overdue actions" value={overdue.length} tone={overdue.length ? 'critical' : undefined} />
            <Kpi
              label="Avg. resolution"
              value={avg.average === null ? '—' : `${avg.average}d`}
              sub={avg.average === null ? 'No resolved issues with dates yet' : `Raised → resolved, ${avg.sample} issue${avg.sample === 1 ? '' : 's'}`}
              wide
            />
          </div>

          <Section title="Open versus resolved">
            <Card>
              <div className="split-bar" role="img" aria-label={`${open} open, ${resolved} resolved or closed`}>
                {open > 0 && <span className="split-open" style={{ flexGrow: open }} title={`Open: ${open}`} />}
                {resolved > 0 && <span className="split-resolved" style={{ flexGrow: resolved }} title={`Resolved / closed: ${resolved}`} />}
              </div>
              <div className="legend">
                <span>
                  <i className="sw sw-open" /> Open <strong>{open}</strong> ({pct(open, issues.length)})
                </span>
                <span>
                  <i className="sw sw-resolved" /> Resolved / closed <strong>{resolved}</strong> ({pct(resolved, issues.length)})
                </span>
              </div>
              <BarList rows={byStatus} total={issues.length} label="Issues by status" compact />
            </Card>
          </Section>

          <Section title="Issues raised by category">
            <Card>
              <BarList rows={byCategory} total={issues.length} label="Issues by category" />
            </Card>
          </Section>

          <Section title="Issues by department or shed">
            <Card>
              <BarList rows={byDepartment} total={issues.length} label="Issues by department" />
            </Card>
          </Section>

          <Section title={`Overdue actions (${overdue.length})`}>
            {overdue.length ? (
              <Card className="table-card">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Issue</th>
                      <th scope="col">Owner</th>
                      <th scope="col" className="num">Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <Link to={`/issues/${i.id}`} className="text-link">
                            {i.ref}
                          </Link>
                          <span className="td-sub">{i.title}</span>
                        </td>
                        <td>{i.actionOwner || '—'}</td>
                        <td className="num text-critical">{overdueDays(i, today)}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <p className="muted small pad-x">No overdue actions. </p>
            )}
          </Section>
        </>
      )}

      <Section title="Monthly activity">
        <Card>
          <MonthlyChart rows={monthly} />
          <div className="table-scroll">
          <table className="table compact">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="num">Raised</th>
                <th scope="col" className="num">Resolved</th>
                <th scope="col" className="num">Feedback</th>
                <th scope="col" className="num"><abbr title="Completed meetings">Mtgs</abbr></th>
                <th scope="col" className="num"><abbr title="Updates published">Posted</abbr></th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.month}>
                  <td className="nowrap">{formatMonthKey(m.month).replace(/ (\d\d)(\d\d)$/, " ’$2")}</td>
                  <td className="num">{m.raised}</td>
                  <td className="num">{m.resolved}</td>
                  <td className="num">{m.feedback}</td>
                  <td className="num">{m.meetings}</td>
                  <td className="num">{m.published}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="small muted">Mtgs = completed meetings. Posted = updates marked published.</p>
        </Card>
      </Section>
      <p className="footnote">BCF Hub · personal prototype · not an official Sunseeker International report</p>
    </div>
  );
}

function pct(n: number, total: number) {
  return total ? `${Math.round((n / total) * 100)}%` : '0%';
}

function Kpi({ label, value, sub, tone, wide }: { label: string; value: number | string; sub?: string; tone?: string; wide?: boolean }) {
  return (
    <div className={`kpi ${tone ? `tone-${tone}` : ''} ${wide ? 'wide' : ''}`}>
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function BarList({ rows, total, label, compact }: { rows: CountRow[]; total: number; label: string; compact?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className={`bars ${compact ? 'compact' : ''}`} aria-label={label}>
      {rows.map((r) => (
        <li key={r.label} className="bar-row" title={`${r.label}: ${r.count} (${pct(r.count, total)})`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="bar-value">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function MonthlyChart({ rows }: { rows: { month: string; raised: number; resolved: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.raised, r.resolved]));
  return (
    <div className="month-chart" role="img" aria-label="Issues raised and resolved per month. Full figures in the table below.">
      <div className="legend">
        <span>
          <i className="sw sw-open" /> Raised
        </span>
        <span>
          <i className="sw sw-resolved" /> Resolved
        </span>
      </div>
      <div className="mc-cols">
        {rows.map((r) => (
          <div key={r.month} className="mc-col" title={`${formatMonthKey(r.month)}: ${r.raised} raised, ${r.resolved} resolved`}>
            <div className="mc-bars">
              <span className="mc-bar raised" style={{ height: `${(r.raised / max) * 100}%` }}>
                {r.raised > 0 && <em>{r.raised}</em>}
              </span>
              <span className="mc-bar resolved" style={{ height: `${(r.resolved / max) * 100}%` }}>
                {r.resolved > 0 && <em>{r.resolved}</em>}
              </span>
            </div>
            <span className="mc-label">{formatMonthKey(r.month).split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
