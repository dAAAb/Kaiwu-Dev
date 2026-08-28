#!/usr/bin/env node
/**
 * check-openapi.mjs — structural lint for the 開物 Kaiwu OpenAPI document.
 *
 * Usage:
 *   node scripts/check-openapi.mjs <path-to-spec.json | https://kaiwu.dev/openapi.json>
 *
 * Asserts (function-calling / agent readiness):
 *   - openapi is 3.1.x, info.version set, servers[] non-empty
 *   - components.schemas.Error exists and requires `error`
 *   - every operation has a unique lowerCamelCase operationId, summary,
 *     description, and non-empty tags declared in top-level tags[]
 *   - every operation's security requirements reference declared securitySchemes
 *   - every operation has a 2xx response with an application/json schema
 *     (a 2xx with a schema under another media type is accepted when the
 *      operation is marked x-stream-response / x-binary-response; 202/204 may
 *      legitimately have no content)
 *   - every 4xx/5xx response has a schema (expected: $ref Error)
 *   - every path parameter is declared and required; every parameter has a schema
 *   - every $ref resolves
 * Exits 1 with a readable list of violations, 2 on usage/load errors.
 */

const arg = process.argv[2];
if (!arg) {
  console.error('usage: node scripts/check-openapi.mjs <spec.json | https://host/openapi.json>');
  process.exit(2);
}

async function load(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error(`unexpected content-type "${ct}" from ${src}`);
    return await res.json();
  }
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(src, 'utf8'));
}

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const violations = [];
const v = (msg) => violations.push(msg);

function resolveRef(spec, $ref) {
  if (typeof $ref !== 'string' || !$ref.startsWith('#/')) return undefined;
  return $ref
    .slice(2)
    .split('/')
    .reduce((o, k) => (o == null ? undefined : o[k.replace(/~1/g, '/').replace(/~0/g, '~')]), spec);
}

function walkRefs(spec, node, path) {
  if (Array.isArray(node)) return node.forEach((n, i) => walkRefs(spec, n, `${path}[${i}]`));
  if (node && typeof node === 'object') {
    if (typeof node.$ref === 'string' && resolveRef(spec, node.$ref) === undefined) v(`${path}: unresolved $ref ${node.$ref}`);
    for (const [k, val] of Object.entries(node)) walkRefs(spec, val, `${path}.${k}`);
  }
}

let spec;
try {
  spec = await load(arg);
} catch (e) {
  console.error(`failed to load ${arg}: ${e.message}`);
  process.exit(2);
}

if (typeof spec.openapi !== 'string' || !spec.openapi.startsWith('3.1')) v(`openapi version is ${spec.openapi}, expected 3.1.x`);
if (!spec.info?.title) v('info.title is missing');
if (!spec.info?.version) v('info.version is missing');
if (!Array.isArray(spec.servers) || spec.servers.length === 0) v('servers[] is empty');
const errorSchema = spec.components?.schemas?.Error;
if (!errorSchema) v('components.schemas.Error is missing');
else if (!Array.isArray(errorSchema.required) || !errorSchema.required.includes('error')) v('components.schemas.Error must require "error"');
const declaredSchemes = new Set(Object.keys(spec.components?.securitySchemes ?? {}));
const declaredTags = new Set((spec.tags ?? []).map((t) => t.name));

const seenIds = new Map();
let pathCount = 0;
let opCount = 0;

for (const [p, item] of Object.entries(spec.paths ?? {})) {
  pathCount++;
  for (const method of HTTP_METHODS) {
    const op = item?.[method];
    if (!op) continue;
    opCount++;
    const where = `${method.toUpperCase()} ${p}`;

    if (!op.operationId) v(`${where}: missing operationId`);
    else {
      if (!/^[a-z][A-Za-z0-9]*$/.test(op.operationId)) v(`${where}: operationId "${op.operationId}" is not lowerCamelCase`);
      if (seenIds.has(op.operationId)) v(`${where}: duplicate operationId "${op.operationId}" (also ${seenIds.get(op.operationId)})`);
      seenIds.set(op.operationId, where);
    }
    if (!op.summary) v(`${where}: missing summary`);
    if (!op.description) v(`${where}: missing description`);
    if (!Array.isArray(op.tags) || op.tags.length === 0) v(`${where}: missing tags`);
    for (const t of op.tags ?? []) if (!declaredTags.has(t)) v(`${where}: tag "${t}" not declared in top-level tags[]`);

    for (const req of op.security ?? []) {
      for (const scheme of Object.keys(req)) if (!declaredSchemes.has(scheme)) v(`${where}: security scheme "${scheme}" not declared`);
    }

    for (const prm of op.parameters ?? []) {
      const param = prm.$ref ? resolveRef(spec, prm.$ref) : prm;
      if (!param?.schema) v(`${where}: parameter "${param?.name}" has no schema`);
      if (param?.in === 'path' && param.required !== true) v(`${where}: path parameter "${param.name}" must be required`);
    }
    for (const m of p.matchAll(/\{([^}]+)\}/g)) {
      const declared = [...(op.parameters ?? []), ...(item.parameters ?? [])]
        .map((x) => (x.$ref ? resolveRef(spec, x.$ref) : x))
        .some((x) => x?.in === 'path' && x.name === m[1]);
      if (!declared) v(`${where}: path parameter {${m[1]}} not declared`);
    }

    if (op.requestBody) {
      const rb = op.requestBody.$ref ? resolveRef(spec, op.requestBody.$ref) : op.requestBody;
      const hasSchema = Object.values(rb?.content ?? {}).some((c) => c && c.schema);
      if (!hasSchema) v(`${where}: requestBody has no schema`);
    }

    const responses = op.responses ?? {};
    if (Object.keys(responses).length === 0) v(`${where}: no responses`);
    let has2xx = false;
    let hasJson2xx = false;
    const streamOk = Boolean(op['x-stream-response'] || op['x-binary-response']);
    for (const [status, rawRes] of Object.entries(responses)) {
      const res = rawRes?.$ref ? resolveRef(spec, rawRes.$ref) : rawRes;
      if (!res?.description) v(`${where}: ${status} response has no description`);
      const content = res?.content ?? {};
      const code = Number(status);
      if (status === 'default' || (code >= 200 && code < 300)) {
        has2xx = true;
        if (content['application/json']?.schema) hasJson2xx = true;
        else if (streamOk && Object.values(content).some((c) => c && c.schema)) hasJson2xx = true;
        else if (Object.keys(content).length === 0 && (code === 202 || code === 204)) hasJson2xx = true; // legitimately empty
        else if (Object.keys(content).length === 0) v(`${where}: ${status} response has no content/schema`);
      } else if (code >= 400) {
        const hasSchema = Object.values(content).some((c) => c && c.schema);
        if (!hasSchema) v(`${where}: ${status} response has no schema`);
        const ref = content['application/json']?.schema?.$ref;
        if (ref && ref !== '#/components/schemas/Error') v(`${where}: ${status} response should $ref components.schemas.Error (got ${ref})`);
      }
    }
    if (!has2xx) v(`${where}: no 2xx response`);
    if (!hasJson2xx) v(`${where}: no 2xx response with application/json schema (or an empty 202/204)`);
  }
}

walkRefs(spec, spec, '$');

console.log(`paths: ${pathCount}, operations: ${opCount}, unique operationIds: ${seenIds.size}`);
if (violations.length) {
  console.error(`\n${violations.length} violation(s):`);
  for (const m of violations) console.error(`  - ${m}`);
  process.exit(1);
}
console.log('OK — OpenAPI document passes all agent-readiness checks.');
