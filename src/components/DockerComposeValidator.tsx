import { useState, useMemo } from 'react';
import YAML from 'yaml';

interface ValidationError {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

const validRestartPolicies = ['no', 'always', 'on-failure', 'unless-stopped'];
const validServiceKeys = new Set([
  'image', 'build', 'command', 'entrypoint', 'container_name', 'depends_on',
  'environment', 'env_file', 'expose', 'ports', 'volumes', 'networks',
  'restart', 'deploy', 'labels', 'logging', 'healthcheck', 'configs',
  'secrets', 'working_dir', 'user', 'hostname', 'domainname', 'dns',
  'dns_search', 'extra_hosts', 'links', 'external_links', 'stdin_open',
  'tty', 'cap_add', 'cap_drop', 'devices', 'privileged', 'read_only',
  'security_opt', 'tmpfs', 'sysctls', 'ulimits', 'stop_signal',
  'stop_grace_period', 'init', 'platform', 'profiles', 'pull_policy',
  'mem_limit', 'memswap_limit', 'mem_reservation', 'cpus', 'cpu_shares',
  'cpu_quota', 'cpu_period', 'cpuset', 'shm_size', 'pid', 'ipc',
  'extends', 'scale', 'runtime', 'isolation', 'network_mode',
  'group_add', 'cgroup_parent', 'credential_spec', 'oom_score_adj',
  'storage_opt', 'annotations',
]);
const validTopLevelKeys = new Set(['version', 'services', 'networks', 'volumes', 'configs', 'secrets', 'name']);

function validate(doc: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    errors.push({ severity: 'error', message: 'Document must be a YAML mapping (object).' });
    return errors;
  }

  const root = doc as Record<string, unknown>;

  // Check top-level keys
  for (const key of Object.keys(root)) {
    if (!validTopLevelKeys.has(key)) {
      errors.push({ severity: 'warning', message: `Unknown top-level key "${key}".`, path: key });
    }
  }

  // Version check
  if (root.version !== undefined) {
    errors.push({
      severity: 'warning',
      message: 'The "version" field is obsolete in Docker Compose v2+. It can be safely removed.',
      path: 'version',
    });
  }

  // Services required
  if (!root.services) {
    errors.push({ severity: 'error', message: 'Missing required "services" key.' });
    return errors;
  }

  if (typeof root.services !== 'object' || root.services === null) {
    errors.push({ severity: 'error', message: '"services" must be a mapping of service definitions.' });
    return errors;
  }

  const services = root.services as Record<string, unknown>;
  const serviceNames = new Set(Object.keys(services));

  for (const [name, def] of Object.entries(services)) {
    const svcPath = `services.${name}`;

    if (typeof def !== 'object' || def === null) {
      errors.push({ severity: 'error', message: `Service "${name}" must be a mapping.`, path: svcPath });
      continue;
    }

    const svc = def as Record<string, unknown>;

    // Must have image or build
    if (!svc.image && !svc.build) {
      errors.push({ severity: 'error', message: `Service "${name}" must have either "image" or "build".`, path: svcPath });
    }

    // Check unknown keys
    for (const key of Object.keys(svc)) {
      if (!validServiceKeys.has(key)) {
        errors.push({ severity: 'warning', message: `Unknown key "${key}" in service "${name}".`, path: `${svcPath}.${key}` });
      }
    }

    // Validate restart policy
    if (svc.restart !== undefined) {
      const restart = String(svc.restart);
      const basePolicy = restart.split(':')[0];
      if (!validRestartPolicies.includes(basePolicy)) {
        errors.push({
          severity: 'error',
          message: `Invalid restart policy "${restart}" in "${name}". Valid: ${validRestartPolicies.join(', ')}.`,
          path: `${svcPath}.restart`,
        });
      }
    }

    // Validate ports
    if (Array.isArray(svc.ports)) {
      for (const port of svc.ports) {
        const portStr = typeof port === 'object' && port !== null ? JSON.stringify(port) : String(port);
        if (typeof port === 'string' || typeof port === 'number') {
          const pStr = String(port);
          if (!/^\d+([:-]\d+)?(\/\w+)?$/.test(pStr) && !/^\d+([:-]\d+)?:\d+([:-]\d+)?(\/\w+)?$/.test(pStr)) {
            errors.push({
              severity: 'warning',
              message: `Unusual port format "${pStr}" in "${name}". Expected format: "host:container" or "container".`,
              path: `${svcPath}.ports`,
            });
          }
        }
      }
    }

    // Validate depends_on references
    if (svc.depends_on) {
      const deps = Array.isArray(svc.depends_on)
        ? svc.depends_on.map(String)
        : typeof svc.depends_on === 'object' && svc.depends_on !== null
          ? Object.keys(svc.depends_on)
          : [];
      for (const dep of deps) {
        if (!serviceNames.has(dep)) {
          errors.push({
            severity: 'error',
            message: `Service "${name}" depends on "${dep}", which is not defined.`,
            path: `${svcPath}.depends_on`,
          });
        }
        if (dep === name) {
          errors.push({
            severity: 'error',
            message: `Service "${name}" depends on itself.`,
            path: `${svcPath}.depends_on`,
          });
        }
      }
    }

    // Validate environment
    if (svc.environment !== undefined && svc.environment !== null) {
      if (!Array.isArray(svc.environment) && typeof svc.environment !== 'object') {
        errors.push({
          severity: 'error',
          message: `"environment" in "${name}" must be a list or mapping.`,
          path: `${svcPath}.environment`,
        });
      }
    }

    // Validate volumes
    if (Array.isArray(svc.volumes)) {
      for (const vol of svc.volumes) {
        if (typeof vol === 'string' && !vol.includes(':') && !vol.startsWith('/') && !vol.startsWith('.')) {
          // Named volume - check if defined at top level
          const topVolumes = root.volumes as Record<string, unknown> | undefined;
          if (topVolumes && typeof topVolumes === 'object' && !Object.keys(topVolumes).includes(vol)) {
            errors.push({
              severity: 'warning',
              message: `Volume "${vol}" used in "${name}" is not defined in top-level "volumes".`,
              path: `${svcPath}.volumes`,
            });
          }
        }
      }
    }
  }

  // Check for circular depends_on
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function hasCycle(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    const svc = services[node] as Record<string, unknown> | undefined;
    if (svc?.depends_on) {
      const deps = Array.isArray(svc.depends_on)
        ? svc.depends_on.map(String)
        : typeof svc.depends_on === 'object' && svc.depends_on !== null
          ? Object.keys(svc.depends_on)
          : [];
      for (const dep of deps) {
        if (serviceNames.has(dep) && hasCycle(dep)) {
          errors.push({
            severity: 'error',
            message: `Circular dependency detected involving "${node}" and "${dep}".`,
          });
          inStack.delete(node);
          return true;
        }
      }
    }
    inStack.delete(node);
    return false;
  }
  for (const name of serviceNames) {
    hasCycle(name);
  }

  return errors;
}

const stackTemplates: Record<string, string> = {
  'Node.js + PostgreSQL': `services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/mydb
      NODE_ENV: development
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: mydb
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:`,

  'Python/Django + Redis': `services:
  web:
    build: .
    command: python manage.py runserver 0.0.0.0:8000
    ports:
      - "8000:8000"
    environment:
      REDIS_URL: redis://redis:6379/0
      DATABASE_URL: postgresql://postgres:password@db:5432/django
    depends_on:
      - db
      - redis
    volumes:
      - .:/app

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: django
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:`,

  'WordPress + MySQL': `services:
  wordpress:
    image: wordpress:latest
    ports:
      - "8080:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: secret
      WORDPRESS_DB_NAME: wordpress
    depends_on:
      - db
    volumes:
      - wp_data:/var/www/html

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: secret
      MYSQL_ROOT_PASSWORD: rootsecret
    volumes:
      - db_data:/var/lib/mysql

volumes:
  wp_data:
  db_data:`,

  'MERN Stack': `services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - api

  api:
    build: ./api
    ports:
      - "5000:5000"
    environment:
      MONGODB_URI: mongodb://mongo:27017/myapp
      NODE_ENV: development
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:`,
};

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

export default function DockerComposeValidator() {
  const [input, setInput] = useState(stackTemplates['Node.js + PostgreSQL']);

  const { parsed, yamlError, validationErrors } = useMemo(() => {
    try {
      const doc = YAML.parse(input);
      return { parsed: doc, yamlError: null, validationErrors: validate(doc) };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'YAML parse error';
      return { parsed: null, yamlError: msg, validationErrors: [] };
    }
  }, [input]);

  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;
  const isValid = !yamlError && errorCount === 0;

  // Extract service names for display
  const serviceNames = parsed?.services ? Object.keys(parsed.services as object) : [];

  return (
    <div class="space-y-4">
      {/* Template Selector */}
      <div class="flex flex-wrap gap-2">
        <span class="text-sm text-[--color-text-secondary] py-1.5">Templates:</span>
        {Object.keys(stackTemplates).map(name => (
          <button
            key={name}
            onClick={() => setInput(stackTemplates[name])}
            class="px-3 py-1.5 rounded-lg text-sm bg-[--color-bg-secondary] border border-[--color-border] text-[--color-text-muted] hover:text-[--color-text-primary] hover:border-[--color-text-muted] transition-colors"
          >
            {name}
          </button>
        ))}
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-[--color-text-secondary]">docker-compose.yml</span>
            <CopyButton text={input} />
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            class="w-full h-[500px] resize-y"
            spellcheck={false}
            placeholder="Paste your docker-compose.yml here..."
          />
        </div>

        {/* Validation Results */}
        <div class="space-y-4">
          {/* Status Banner */}
          <div class={`rounded-xl border p-4 ${
            yamlError
              ? 'bg-red-500/10 border-red-500/30'
              : isValid
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <div class="flex items-center gap-2">
              <span class={`text-lg ${yamlError ? 'text-[--color-danger]' : isValid ? 'text-[--color-success]' : 'text-[--color-warning]'}`}>
                {yamlError ? 'YAML Error' : isValid ? 'Valid' : `${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* YAML Error */}
          {yamlError && (
            <div class="rounded-xl bg-[--color-bg-secondary] border border-red-500/30 p-4">
              <h3 class="text-sm font-bold text-[--color-danger] mb-2">YAML Syntax Error</h3>
              <pre class="text-sm text-red-300 whitespace-pre-wrap font-mono">{yamlError}</pre>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div class="space-y-2">
              {validationErrors.map((err, i) => (
                <div
                  key={i}
                  class={`rounded-lg border p-3 text-sm ${
                    err.severity === 'error'
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  <div class="flex items-start gap-2">
                    <span class={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                      err.severity === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {err.severity}
                    </span>
                    <div>
                      <p class="text-[--color-text-primary]">{err.message}</p>
                      {err.path && <p class="text-xs text-[--color-text-muted] font-mono mt-1">{err.path}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Services Overview */}
          {serviceNames.length > 0 && (
            <div class="rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4">
              <h3 class="text-sm font-medium text-[--color-text-secondary] mb-3">Services ({serviceNames.length})</h3>
              <div class="space-y-2">
                {serviceNames.map(name => {
                  const svc = (parsed.services as Record<string, Record<string, unknown>>)[name];
                  return (
                    <div key={name} class="flex items-center justify-between p-2 rounded-lg bg-[--color-bg-tertiary]">
                      <div>
                        <span class="font-mono font-medium text-[--color-accent]">{name}</span>
                        {svc?.image && <span class="text-xs text-[--color-text-muted] ml-2">{String(svc.image)}</span>}
                        {svc?.build && <span class="text-xs text-[--color-text-muted] ml-2">build: {typeof svc.build === 'string' ? svc.build : '.'}</span>}
                      </div>
                      {svc?.ports && Array.isArray(svc.ports) && (
                        <span class="text-xs font-mono text-[--color-text-muted]">
                          {svc.ports.map(String).join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DigitalOcean affiliate - contextually relevant */}
          {isValid && serviceNames.length > 0 && (
            <a
              href="https://m.do.co/c/b0a84c472a33"
              target="_blank"
              rel="noopener noreferrer"
              class="block rounded-xl bg-[--color-bg-secondary] border border-[--color-border] p-4 hover:border-[--color-accent] transition-colors no-underline"
            >
              <p class="text-sm text-[--color-text-secondary]">
                Ready to deploy? Get $200 in free credits on <span class="text-[--color-accent]">DigitalOcean</span> to run your Docker containers in the cloud.
              </p>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
