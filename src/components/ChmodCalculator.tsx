import { useState, useCallback } from 'react';

type PermSet = { read: boolean; write: boolean; execute: boolean };
type Perms = { owner: PermSet; group: PermSet; other: PermSet };
type Special = { setuid: boolean; setgid: boolean; sticky: boolean };

const defaultPerms: Perms = {
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: false, execute: true },
  other: { read: true, write: false, execute: true },
};

const presets: { label: string; octal: string; desc: string }[] = [
  { label: '755', octal: '755', desc: 'Standard directory / executable' },
  { label: '644', octal: '644', desc: 'Standard file' },
  { label: '700', octal: '700', desc: 'Owner-only access' },
  { label: '600', octal: '600', desc: 'Owner read/write only' },
  { label: '777', octal: '777', desc: 'Full access (dangerous)' },
  { label: '666', octal: '666', desc: 'Read/write all (no execute)' },
  { label: '750', octal: '750', desc: 'Owner full, group read/execute' },
  { label: '640', octal: '640', desc: 'Owner rw, group read' },
];

function octalToPerms(octal: string): Perms {
  const o = parseInt(octal[0] || '0', 10);
  const g = parseInt(octal[1] || '0', 10);
  const t = parseInt(octal[2] || '0', 10);
  const toBits = (n: number): PermSet => ({
    read: !!(n & 4), write: !!(n & 2), execute: !!(n & 1),
  });
  return { owner: toBits(o), group: toBits(g), other: toBits(t) };
}

function permsToOctal(p: PermSet): number {
  return (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
}

function permsToSymbolic(p: PermSet): string {
  return (p.read ? 'r' : '-') + (p.write ? 'w' : '-') + (p.execute ? 'x' : '-');
}

function getWarnings(perms: Perms, special: Special): string[] {
  const w: string[] = [];
  const oO = permsToOctal(perms.owner);
  const oG = permsToOctal(perms.group);
  const oT = permsToOctal(perms.other);
  if (oO === 7 && oG === 7 && oT === 7) w.push('777 gives full access to everyone. Almost never appropriate.');
  if (perms.other.write) w.push('World-writable: any user on the system can modify this file.');
  if (perms.other.execute && perms.other.write) w.push('World-writable and executable: any user can modify and run this.');
  if (special.setuid) w.push('SUID bit set: file runs with owner privileges regardless of who executes it.');
  if (special.setgid) w.push('SGID bit set: file runs with group privileges. On directories, new files inherit group.');
  return w;
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

export default function ChmodCalculator() {
  const [perms, setPerms] = useState<Perms>(defaultPerms);
  const [special, setSpecial] = useState<Special>({ setuid: false, setgid: false, sticky: false });
  const [filename, setFilename] = useState('filename');

  const toggle = useCallback((role: keyof Perms, perm: keyof PermSet) => {
    setPerms(prev => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }));
  }, []);

  const applyPreset = useCallback((octal: string) => {
    setPerms(octalToPerms(octal));
    setSpecial({ setuid: false, setgid: false, sticky: false });
  }, []);

  const specialBit = (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0);
  const octalStr = `${permsToOctal(perms.owner)}${permsToOctal(perms.group)}${permsToOctal(perms.other)}`;
  const fullOctal = specialBit > 0 ? `${specialBit}${octalStr}` : octalStr;
  const symbolic = permsToSymbolic(perms.owner) + permsToSymbolic(perms.group) + permsToSymbolic(perms.other);
  const command = `chmod ${fullOctal} ${filename}`;
  const warnings = getWarnings(perms, special);

  const roles: { key: keyof Perms; label: string }[] = [
    { key: 'owner', label: 'Owner' },
    { key: 'group', label: 'Group' },
    { key: 'other', label: 'Other' },
  ];
  const permTypes: { key: keyof PermSet; label: string; short: string }[] = [
    { key: 'read', label: 'Read', short: 'r' },
    { key: 'write', label: 'Write', short: 'w' },
    { key: 'execute', label: 'Execute', short: 'x' },
  ];

  return (
    <div class="space-y-6">
      {/* Permission Grid */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-[--color-border]">
              <th class="text-left p-3 text-sm font-medium text-[--color-text-secondary]"></th>
              {permTypes.map(p => (
                <th key={p.key} class="p-3 text-center text-sm font-medium text-[--color-text-secondary]">
                  {p.label} <span class="text-[--color-text-muted]">({p.short})</span>
                </th>
              ))}
              <th class="p-3 text-center text-sm font-medium text-[--color-text-secondary]">Octal</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.key} class="border-b border-[--color-border] last:border-0">
                <td class="p-3 text-sm font-medium">{role.label}</td>
                {permTypes.map(perm => (
                  <td key={perm.key} class="p-3 text-center">
                    <button
                      onClick={() => toggle(role.key, perm.key)}
                      class={`w-10 h-10 rounded-lg text-sm font-mono font-bold transition-all ${
                        perms[role.key][perm.key]
                          ? 'bg-[--color-accent] text-white shadow-lg shadow-blue-500/20'
                          : 'bg-[--color-bg-tertiary] text-[--color-text-muted] hover:bg-[--color-border]'
                      }`}
                    >
                      {perms[role.key][perm.key] ? perm.short : '-'}
                    </button>
                  </td>
                ))}
                <td class="p-3 text-center font-mono text-lg font-bold text-[--color-accent]">
                  {permsToOctal(perms[role.key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Special Bits */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
        <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">Special Bits</h3>
        <div class="flex flex-wrap gap-3">
          {([
            { key: 'setuid' as const, label: 'SUID', desc: 'Run as owner' },
            { key: 'setgid' as const, label: 'SGID', desc: 'Run as group' },
            { key: 'sticky' as const, label: 'Sticky', desc: 'Restrict deletion' },
          ]).map(s => (
            <button
              key={s.key}
              onClick={() => setSpecial(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
              class={`px-4 py-2 rounded-lg text-sm transition-all ${
                special[s.key]
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                  : 'bg-[--color-bg-tertiary] text-[--color-text-muted] border border-transparent hover:border-[--color-border]'
              }`}
            >
              {s.label} <span class="text-xs opacity-70">({s.desc})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Common Presets */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
        <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">Common Presets</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.octal)}
              class={`p-3 rounded-lg text-left transition-all border ${
                octalStr === p.octal && specialBit === 0
                  ? 'border-[--color-accent] bg-blue-500/10'
                  : 'border-[--color-border] bg-[--color-bg-tertiary] hover:border-[--color-text-muted]'
              }`}
            >
              <div class="font-mono font-bold text-sm">{p.label}</div>
              <div class="text-xs text-[--color-text-muted] mt-0.5">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-[--color-text-secondary]">Octal</span>
            <CopyButton text={fullOctal} />
          </div>
          <div class="font-mono text-3xl font-bold text-[--color-accent]">{fullOctal}</div>
        </div>
        <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-[--color-text-secondary]">Symbolic</span>
            <CopyButton text={symbolic} />
          </div>
          <div class="font-mono text-3xl font-bold">{symbolic}</div>
        </div>
      </div>

      {/* Command */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-[--color-text-secondary]">Command</span>
          <CopyButton text={command} />
        </div>
        <div class="flex items-center gap-2">
          <code class="flex-1 font-mono text-lg bg-[--color-bg-primary] rounded-lg px-4 py-3">
            <span class="text-[--color-text-muted]">$ </span>
            <span class="text-[--color-success]">chmod</span>{' '}
            <span class="text-[--color-accent]">{fullOctal}</span>{' '}
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              class="bg-transparent border-none outline-none text-[--color-warning] font-mono text-lg p-0 w-32 inline"
              style={{ border: 'none', padding: 0, background: 'transparent' }}
            />
          </code>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div class="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-2">
          <h3 class="text-sm font-bold text-[--color-danger]">Security Warnings</h3>
          {warnings.map((w, i) => (
            <p key={i} class="text-sm text-red-300">{w}</p>
          ))}
        </div>
      )}

      {/* Umask Calculator */}
      <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
        <h3 class="text-sm font-medium text-[--color-text-secondary] mb-2">Umask</h3>
        <p class="text-xs text-[--color-text-muted] mb-3">
          The umask value that would result in these permissions when creating a new file (from 666) or directory (from 777).
        </p>
        <div class="flex gap-4 font-mono">
          <div>
            <div class="text-xs text-[--color-text-muted] mb-1">For files (666)</div>
            <div class="text-lg font-bold text-[--color-accent]">
              {String(Math.max(0, 6 - permsToOctal(perms.owner)))}
              {String(Math.max(0, 6 - permsToOctal(perms.group)))}
              {String(Math.max(0, 6 - permsToOctal(perms.other)))}
            </div>
          </div>
          <div>
            <div class="text-xs text-[--color-text-muted] mb-1">For directories (777)</div>
            <div class="text-lg font-bold text-[--color-accent]">
              {String(7 - permsToOctal(perms.owner))}
              {String(7 - permsToOctal(perms.group))}
              {String(7 - permsToOctal(perms.other))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
