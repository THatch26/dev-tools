import { useState, useCallback, useMemo } from 'react';
import * as TOML from 'smol-toml';
import YAML from 'yaml';

type Format = 'toml' | 'json' | 'yaml';

const samples: Record<Format, string> = {
  toml: `[package]
name = "my-project"
version = "1.0.0"
authors = ["Dev <dev@example.com>"]

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }

[profile.release]
opt-level = 3
lto = true`,
  json: `{
  "package": {
    "name": "my-project",
    "version": "1.0.0",
    "authors": ["Dev <dev@example.com>"]
  },
  "dependencies": {
    "serde": { "version": "1.0", "features": ["derive"] },
    "tokio": { "version": "1", "features": ["full"] }
  }
}`,
  yaml: `package:
  name: my-project
  version: 1.0.0
  authors:
    - Dev <dev@example.com>

dependencies:
  serde:
    version: "1.0"
    features:
      - derive
  tokio:
    version: "1"
    features:
      - full`,
};

function detectFormat(input: string): Format {
  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { JSON.parse(trimmed); return 'json'; } catch {}
  }
  try { TOML.parse(trimmed); return 'toml'; } catch {}
  try { YAML.parse(trimmed); if (typeof YAML.parse(trimmed) === 'object') return 'yaml'; } catch {}
  return 'toml';
}

function parse(input: string, format: Format): unknown {
  switch (format) {
    case 'toml': return TOML.parse(input);
    case 'json': return JSON.parse(input);
    case 'yaml': return YAML.parse(input);
  }
}

function serialize(data: unknown, format: Format): string {
  switch (format) {
    case 'toml': return TOML.stringify(data as Record<string, unknown>);
    case 'json': return JSON.stringify(data, null, 2);
    case 'yaml': return YAML.stringify(data, { indent: 2 });
  }
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

const formatLabels: Record<Format, string> = { toml: 'TOML', json: 'JSON', yaml: 'YAML' };

export default function TomlConverter() {
  const [input, setInput] = useState(samples.toml);
  const [inputFormat, setInputFormat] = useState<Format>('toml');
  const [outputFormat, setOutputFormat] = useState<Format>('json');

  const { output, error } = useMemo(() => {
    try {
      const data = parse(input, inputFormat);
      return { output: serialize(data, outputFormat), error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Parse error';
      return { output: '', error: msg };
    }
  }, [input, inputFormat, outputFormat]);

  const handleAutoDetect = useCallback(() => {
    const detected = detectFormat(input);
    setInputFormat(detected);
  }, [input]);

  const handleSwap = useCallback(() => {
    if (output && !error) {
      setInput(output);
      setInputFormat(outputFormat);
      setOutputFormat(inputFormat);
    }
  }, [output, error, inputFormat, outputFormat]);

  const loadSample = useCallback((fmt: Format) => {
    setInput(samples[fmt]);
    setInputFormat(fmt);
  }, []);

  return (
    <div class="space-y-4">
      {/* Format Controls */}
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-sm text-[--color-text-secondary]">From:</label>
          <div class="flex rounded-lg overflow-hidden border border-[--color-border]">
            {(['toml', 'json', 'yaml'] as Format[]).map(f => (
              <button
                key={f}
                onClick={() => setInputFormat(f)}
                class={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  inputFormat === f
                    ? 'bg-[--color-accent] text-white'
                    : 'bg-[--color-bg-secondary] text-[--color-text-muted] hover:text-[--color-text-primary]'
                }`}
              >
                {formatLabels[f]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSwap}
          class="px-3 py-1.5 rounded-lg bg-[--color-bg-secondary] border border-[--color-border] text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors text-sm"
          title="Swap input/output"
        >
          &#8646;
        </button>

        <div class="flex items-center gap-2">
          <label class="text-sm text-[--color-text-secondary]">To:</label>
          <div class="flex rounded-lg overflow-hidden border border-[--color-border]">
            {(['toml', 'json', 'yaml'] as Format[]).map(f => (
              <button
                key={f}
                onClick={() => setOutputFormat(f)}
                class={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  outputFormat === f
                    ? 'bg-[--color-accent] text-white'
                    : 'bg-[--color-bg-secondary] text-[--color-text-muted] hover:text-[--color-text-primary]'
                }`}
              >
                {formatLabels[f]}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAutoDetect}
          class="px-3 py-1.5 rounded-lg bg-[--color-bg-tertiary] text-[--color-text-muted] hover:text-[--color-text-primary] text-sm transition-colors"
        >
          Auto-detect
        </button>
      </div>

      {/* Sample Buttons */}
      <div class="flex gap-2">
        <span class="text-xs text-[--color-text-muted] py-1">Load sample:</span>
        {(['toml', 'json', 'yaml'] as Format[]).map(f => (
          <button
            key={f}
            onClick={() => loadSample(f)}
            class="text-xs px-2 py-1 rounded bg-[--color-bg-tertiary] text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"
          >
            {formatLabels[f]}
          </button>
        ))}
      </div>

      {/* Editor Panels */}
      <div class="grid lg:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-[--color-text-secondary]">
              Input ({formatLabels[inputFormat]})
            </span>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            class="w-full h-80 resize-y"
            spellcheck={false}
          />
        </div>
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-[--color-text-secondary]">
              Output ({formatLabels[outputFormat]})
            </span>
            {output && <CopyButton text={output} />}
          </div>
          <textarea
            value={error ? '' : output}
            readOnly
            class="w-full h-80 resize-y"
            placeholder={error ? '' : 'Output will appear here...'}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div class="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
          <h3 class="text-sm font-bold text-[--color-danger] mb-1">Parse Error</h3>
          <pre class="text-sm text-red-300 whitespace-pre-wrap font-mono">{error}</pre>
        </div>
      )}
    </div>
  );
}
