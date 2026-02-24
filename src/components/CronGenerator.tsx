import { useState, useMemo } from 'react';
import cronstrue from 'cronstrue';

interface FieldDef {
  name: string;
  label: string;
  min: number;
  max: number;
  options?: { value: string; label: string }[];
}

const fields: FieldDef[] = [
  { name: 'minute', label: 'Minute', min: 0, max: 59 },
  { name: 'hour', label: 'Hour', min: 0, max: 23 },
  { name: 'dayOfMonth', label: 'Day of Month', min: 1, max: 31 },
  {
    name: 'month', label: 'Month', min: 1, max: 12,
    options: [
      { value: '*', label: 'Every month' },
      { value: '1', label: 'January' }, { value: '2', label: 'February' },
      { value: '3', label: 'March' }, { value: '4', label: 'April' },
      { value: '5', label: 'May' }, { value: '6', label: 'June' },
      { value: '7', label: 'July' }, { value: '8', label: 'August' },
      { value: '9', label: 'September' }, { value: '10', label: 'October' },
      { value: '11', label: 'November' }, { value: '12', label: 'December' },
    ],
  },
  {
    name: 'dayOfWeek', label: 'Day of Week', min: 0, max: 6,
    options: [
      { value: '*', label: 'Every day' },
      { value: '1', label: 'Monday' }, { value: '2', label: 'Tuesday' },
      { value: '3', label: 'Wednesday' }, { value: '4', label: 'Thursday' },
      { value: '5', label: 'Friday' }, { value: '6', label: 'Saturday' },
      { value: '0', label: 'Sunday' },
      { value: '1-5', label: 'Weekdays (Mon-Fri)' },
      { value: '0,6', label: 'Weekends (Sat-Sun)' },
    ],
  },
];

const presets: { label: string; cron: string; desc: string }[] = [
  { label: 'Every minute', cron: '* * * * *', desc: 'Runs every minute' },
  { label: 'Every 5 minutes', cron: '*/5 * * * *', desc: 'Runs every 5 minutes' },
  { label: 'Every 15 minutes', cron: '*/15 * * * *', desc: 'Runs every 15 minutes' },
  { label: 'Every hour', cron: '0 * * * *', desc: 'At minute 0 of every hour' },
  { label: 'Every day at midnight', cron: '0 0 * * *', desc: 'At 00:00 every day' },
  { label: 'Every day at 9am', cron: '0 9 * * *', desc: 'At 09:00 every day' },
  { label: 'Weekdays at 9am', cron: '0 9 * * 1-5', desc: 'At 09:00, Monday through Friday' },
  { label: 'Every Sunday at midnight', cron: '0 0 * * 0', desc: 'At 00:00 every Sunday' },
  { label: 'First of month at midnight', cron: '0 0 1 * *', desc: 'At 00:00 on the 1st' },
  { label: 'Every 6 hours', cron: '0 */6 * * *', desc: 'At minute 0 every 6 hours' },
  { label: 'Every 30 minutes', cron: '*/30 * * * *', desc: 'Every 30 minutes' },
  { label: 'Yearly (Jan 1 midnight)', cron: '0 0 1 1 *', desc: 'At 00:00 on January 1st' },
];

function getNextExecutions(expression: string, count: number): Date[] {
  const dates: Date[] = [];
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return dates;

  const now = new Date();
  const current = new Date(now);
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  function matchesField(value: number, field: string, min: number, max: number): boolean {
    if (field === '*') return true;
    for (const part of field.split(',')) {
      if (part.includes('/')) {
        const [range, stepStr] = part.split('/');
        const step = parseInt(stepStr, 10);
        let start = min;
        let end = max;
        if (range !== '*' && range.includes('-')) {
          [start, end] = range.split('-').map(Number);
        } else if (range !== '*') {
          start = parseInt(range, 10);
        }
        for (let i = start; i <= end; i += step) {
          if (i === value) return true;
        }
      } else if (part.includes('-')) {
        const [s, e] = part.split('-').map(Number);
        if (value >= s && value <= e) return true;
      } else {
        if (parseInt(part, 10) === value) return true;
      }
    }
    return false;
  }

  let iterations = 0;
  while (dates.length < count && iterations < 525960) {
    iterations++;
    const min = current.getMinutes();
    const hr = current.getHours();
    const dom = current.getDate();
    const mon = current.getMonth() + 1;
    const dow = current.getDay();

    if (
      matchesField(min, parts[0], 0, 59) &&
      matchesField(hr, parts[1], 0, 23) &&
      matchesField(dom, parts[2], 1, 31) &&
      matchesField(mon, parts[3], 1, 12) &&
      matchesField(dow, parts[4], 0, 6)
    ) {
      dates.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + 1);
  }
  return dates;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      class="text-xs px-2 py-1 rounded bg-[--color-bg-tertiary] text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function CronGenerator() {
  const [expression, setExpression] = useState('0 9 * * 1-5');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    minute: '0', hour: '9', dayOfMonth: '*', month: '*', dayOfWeek: '1-5',
  });

  const updateField = (name: string, value: string) => {
    const newValues = { ...fieldValues, [name]: value };
    setFieldValues(newValues);
    setExpression(`${newValues.minute} ${newValues.hour} ${newValues.dayOfMonth} ${newValues.month} ${newValues.dayOfWeek}`);
  };

  const handleExpressionChange = (value: string) => {
    setExpression(value);
    const parts = value.trim().split(/\s+/);
    if (parts.length === 5) {
      setFieldValues({
        minute: parts[0], hour: parts[1], dayOfMonth: parts[2],
        month: parts[3], dayOfWeek: parts[4],
      });
    }
  };

  const applyPreset = (cron: string) => {
    handleExpressionChange(cron);
  };

  const humanReadable = useMemo(() => {
    try {
      return cronstrue.toString(expression, { use24HourTimeFormat: false });
    } catch {
      return null;
    }
  }, [expression]);

  const nextDates = useMemo(() => getNextExecutions(expression, 10), [expression]);

  const isValid = expression.trim().split(/\s+/).length === 5 && humanReadable !== null;

  return (
    <div class="space-y-6">
      {/* Expression Input */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-[--color-text-secondary]">Cron Expression</span>
          <CopyButton text={expression} />
        </div>
        <input
          type="text"
          value={expression}
          onChange={e => handleExpressionChange(e.target.value)}
          class="w-full text-2xl font-mono font-bold text-center py-3"
          spellcheck={false}
        />
        {humanReadable && (
          <p class="text-center text-[--color-success] text-sm">{humanReadable}</p>
        )}
        {!isValid && expression.trim() && (
          <p class="text-center text-[--color-danger] text-sm">Invalid cron expression. Use 5 space-separated fields.</p>
        )}

        {/* Field Labels */}
        <div class="grid grid-cols-5 gap-2 text-center">
          {['Minute', 'Hour', 'Day (Month)', 'Month', 'Day (Week)'].map(label => (
            <div key={label} class="text-xs text-[--color-text-muted]">{label}</div>
          ))}
        </div>
      </div>

      {/* Field Builder */}
      <div class="grid sm:grid-cols-5 gap-3">
        {fields.map(field => (
          <div key={field.name} class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-3 space-y-2">
            <label class="text-xs font-medium text-[--color-text-secondary]">{field.label}</label>
            {field.options ? (
              <select
                value={fieldValues[field.name]}
                onChange={e => updateField(field.name, e.target.value)}
                class="w-full text-sm"
              >
                {field.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={fieldValues[field.name]}
                onChange={e => updateField(field.name, e.target.value)}
                class="w-full text-sm font-mono"
                placeholder={`${field.min}-${field.max}`}
              />
            )}
            <div class="text-xs text-[--color-text-muted]">
              Range: {field.min}-{field.max}
            </div>
          </div>
        ))}
      </div>

      {/* Presets */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
        <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">Common Presets</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {presets.map(p => (
            <button
              key={p.cron}
              onClick={() => applyPreset(p.cron)}
              class={`p-2.5 rounded-lg text-left transition-all border text-sm ${
                expression === p.cron
                  ? 'border-[--color-accent] bg-blue-500/10'
                  : 'border-[--color-border] bg-[--color-bg-tertiary] hover:border-[--color-text-muted]'
              }`}
            >
              <div class="font-medium text-xs">{p.label}</div>
              <div class="font-mono text-xs text-[--color-text-muted] mt-0.5">{p.cron}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Next Executions */}
      {nextDates.length > 0 && (
        <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
          <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">
            Next {nextDates.length} Executions
          </h3>
          <div class="space-y-1.5">
            {nextDates.map((date, i) => (
              <div key={i} class="flex items-center gap-3 text-sm font-mono">
                <span class="text-[--color-text-muted] w-6 text-right">{i + 1}.</span>
                <span class="text-[--color-text-primary]">
                  {date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <span class="text-[--color-accent]">
                  {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Syntax Reference */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
        <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">Syntax Reference</h3>
        <div class="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm font-mono">
          <div class="flex justify-between"><span class="text-[--color-text-muted]">*</span><span>Any value</span></div>
          <div class="flex justify-between"><span class="text-[--color-text-muted]">,</span><span>Value list (1,3,5)</span></div>
          <div class="flex justify-between"><span class="text-[--color-text-muted]">-</span><span>Range (1-5)</span></div>
          <div class="flex justify-between"><span class="text-[--color-text-muted]">/</span><span>Step (*/15)</span></div>
        </div>
      </div>
    </div>
  );
}
