import { useState, useCallback } from 'react';

type OutputFormat = 'env' | 'json' | 'yaml' | 'docker' | 'shell';

interface EnvVar {
  key: string;
  value: string;
  comment?: string;
}

const templates: Record<string, string> = {
  'Next.js': `# Next.js Environment Variables
# Public variables (exposed to browser)
NEXT_PUBLIC_APP_NAME=my-app
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Server-only variables
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000`,

  'Express': `# Express.js Environment Variables
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Auth
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000`,

  'Django': `# Django Environment Variables
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Email
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587`,

  'Laravel': `# Laravel Environment Variables
APP_NAME=Laravel
APP_ENV=local
APP_KEY=base64:generated-key-here
APP_DEBUG=true
APP_URL=http://localhost

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=

# Mail
MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025`,

  'Rails': `# Ruby on Rails Environment Variables
RAILS_ENV=development
SECRET_KEY_BASE=your-secret-key-base
DATABASE_URL=postgresql://user:password@localhost:5432/mydb_development

# Redis
REDIS_URL=redis://localhost:6379/0

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_BUCKET=`,
};

function parseEnv(text: string): EnvVar[] {
  const vars: EnvVar[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    const commentMatch = value.match(/\s+#\s(.+)$/);
    const comment = commentMatch ? commentMatch[1] : undefined;
    if (commentMatch) value = value.slice(0, commentMatch.index).trim();
    vars.push({ key, value, comment });
  }
  return vars;
}

function toFormat(vars: EnvVar[], format: OutputFormat): string {
  switch (format) {
    case 'env':
      return vars.map(v => `${v.key}=${v.value}`).join('\n');
    case 'json': {
      const obj: Record<string, string> = {};
      vars.forEach(v => { obj[v.key] = v.value; });
      return JSON.stringify(obj, null, 2);
    }
    case 'yaml':
      return vars.map(v => `${v.key}: "${v.value.replace(/"/g, '\\"')}"`).join('\n');
    case 'docker':
      return vars.map(v => `${v.key}=${v.value}`).join('\n');
    case 'shell':
      return vars.map(v => `export ${v.key}="${v.value.replace(/"/g, '\\"')}"`).join('\n');
  }
}

function sortVars(text: string): string {
  const lines = text.split('\n');
  const groups: string[][] = [[]];
  for (const line of lines) {
    if (line.trim() === '' && groups[groups.length - 1].length > 0) {
      groups.push([]);
    } else {
      groups[groups.length - 1].push(line);
    }
  }
  return groups.map(group => {
    const comments: string[] = [];
    const entries: string[] = [];
    group.forEach(line => {
      if (line.trim().startsWith('#') || line.trim() === '') comments.push(line);
      else entries.push(line);
    });
    return [...comments, ...entries.sort()].join('\n');
  }).join('\n\n');
}

function dedupVars(text: string): string {
  const lines = text.split('\n');
  const seen = new Set<string>();
  const result: string[] = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) {
      result.unshift(lines[i]);
      continue;
    }
    const key = line.split('=')[0]?.trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.unshift(lines[i]);
    }
  }
  return result.join('\n');
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

const formatLabels: Record<OutputFormat, string> = {
  env: '.env', json: 'JSON', yaml: 'YAML', docker: 'Docker env', shell: 'Shell export',
};

export default function EnvEditor() {
  const [content, setContent] = useState(templates['Next.js']);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('json');

  const vars = parseEnv(content);
  const output = toFormat(vars, outputFormat);
  const varCount = vars.length;
  const uniqueKeys = new Set(vars.map(v => v.key));
  const dupeCount = varCount - uniqueKeys.size;

  const handleSort = useCallback(() => setContent(prev => sortVars(prev)), []);
  const handleDedup = useCallback(() => setContent(prev => dedupVars(prev)), []);

  return (
    <div class="space-y-4">
      {/* Template Selector */}
      <div class="flex flex-wrap gap-2">
        <span class="text-sm text-[--color-text-secondary] py-1.5">Template:</span>
        {Object.keys(templates).map(name => (
          <button
            key={name}
            onClick={() => setContent(templates[name])}
            class="px-3 py-1.5 rounded-lg text-sm bg-[--color-bg-secondary] border border-[--color-border] text-[--color-text-muted] hover:text-[--color-text-primary] hover:border-[--color-text-muted] transition-colors"
          >
            {name}
          </button>
        ))}
      </div>

      {/* Stats & Actions */}
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-[--color-text-muted]">
          {varCount} variable{varCount !== 1 ? 's' : ''}
          {dupeCount > 0 && <span class="text-[--color-warning]"> ({dupeCount} duplicate{dupeCount !== 1 ? 's' : ''})</span>}
        </span>
        <button onClick={handleSort} class="text-xs px-2 py-1 rounded bg-[--color-bg-tertiary] text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors">
          Sort A-Z
        </button>
        {dupeCount > 0 && (
          <button onClick={handleDedup} class="text-xs px-2 py-1 rounded bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 transition-colors">
            Remove duplicates
          </button>
        )}
      </div>

      {/* Editor Panels */}
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-[--color-text-secondary]">Input (.env format)</span>
            <CopyButton text={content} />
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            class="w-full h-96 resize-y"
            spellcheck={false}
            placeholder="KEY=value&#10;ANOTHER_KEY=another-value"
          />
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-[--color-text-secondary]">Output:</span>
              <select
                value={outputFormat}
                onChange={e => setOutputFormat(e.target.value as OutputFormat)}
                class="text-sm bg-[--color-bg-tertiary] border border-[--color-border] rounded px-2 py-1"
              >
                {Object.entries(formatLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <CopyButton text={output} />
          </div>
          <textarea
            value={output}
            readOnly
            class="w-full h-96 resize-y"
          />
        </div>
      </div>

      {/* Variable Table */}
      {vars.length > 0 && (
        <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] overflow-hidden">
          <div class="p-3 border-b border-[--color-border]">
            <h3 class="text-sm font-medium text-[--color-text-secondary]">Parsed Variables</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-[--color-border]">
                  <th class="text-left p-2 px-3 text-[--color-text-muted] font-medium">Key</th>
                  <th class="text-left p-2 px-3 text-[--color-text-muted] font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {vars.map((v, i) => (
                  <tr key={i} class="border-b border-[--color-border] last:border-0">
                    <td class="p-2 px-3 font-mono text-[--color-accent]">{v.key}</td>
                    <td class="p-2 px-3 font-mono text-[--color-text-secondary] max-w-xs truncate">{v.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
