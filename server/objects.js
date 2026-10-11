// Whitelist of supported standard objects and the fields we prefer to show (5 to 10).
export const OBJECTS = {
  Account: {
    label: 'Account',
    nameField: 'Name',
    preferred: ['Name', 'Type', 'Industry', 'Phone', 'Website', 'BillingCity', 'BillingCountry', 'AnnualRevenue', 'NumberOfEmployees', 'Rating'],
  },
  Opportunity: {
    label: 'Opportunity',
    nameField: 'Name',
    preferred: ['Name', 'StageName', 'Amount', 'CloseDate', 'Type', 'LeadSource', 'Probability', 'NextStep', 'Description'],
  },
  Lead: {
    label: 'Lead',
    nameField: 'Name',
    preferred: ['FirstName', 'LastName', 'Company', 'Email', 'Phone', 'Status', 'LeadSource', 'Title', 'Industry', 'Rating'],
  },
  Contact: {
    label: 'Contact',
    nameField: 'Name',
    preferred: ['FirstName', 'LastName', 'Email', 'Phone', 'Title', 'Department', 'LeadSource', 'MailingCity', 'MailingCountry', 'Birthdate'],
  },
  Case: {
    label: 'Case',
    nameField: 'Subject',
    preferred: ['Subject', 'Status', 'Priority', 'Origin', 'Type', 'Reason', 'Description', 'SuppliedName', 'SuppliedEmail', 'SuppliedPhone'],
  },
};

export const MIN_FIELDS = 5;
export const MAX_FIELDS = 10;
const FILLER_TYPES = new Set(['string', 'picklist', 'email', 'phone', 'url', 'double', 'currency', 'int', 'percent', 'date', 'boolean', 'textarea']);
const NUMERIC = new Set(['double', 'currency', 'int', 'percent']);

export class ValidationError extends Error {
  status = 400;
}

export const isObjectName = (n) => typeof n === 'string' && Object.hasOwn(OBJECTS, n);
export const isSfId = (v) => typeof v === 'string' && /^[a-zA-Z0-9]{15,18}$/.test(v);

export function escapeSoql(value) {
  return String(value)
    .replace(/[\\'"]/g, '\\$&')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
const escapeLike = (value) => escapeSoql(value).replace(/[%_]/g, '\\$&');

function toMeta(f) {
  return {
    name: f.name,
    label: f.label,
    type: f.type,
    required: Boolean(f.createable && !f.nillable && !f.defaultedOnCreate && f.type !== 'boolean'),
    createable: Boolean(f.createable),
    updateable: Boolean(f.updateable),
    length: f.length || null,
    picklistValues: f.type === 'picklist' ? (f.picklistValues || []).filter((p) => p.active).map((p) => ({ value: p.value, label: p.label })) : undefined,
  };
}

// Choose 5-10 fields from the live describe result, so the UI always matches the org.
export function selectFields(describe, preferred) {
  const byName = new Map(describe.fields.map((f) => [f.name, f]));
  const chosen = preferred.filter((n) => byName.has(n)).slice(0, MAX_FIELDS);
  if (chosen.length < MIN_FIELDS) {
    for (const f of describe.fields) {
      if (chosen.length >= MIN_FIELDS) break;
      if (f.name !== 'Id' && !chosen.includes(f.name) && FILLER_TYPES.has(f.type) && !f.deprecatedAndHidden) chosen.push(f.name);
    }
  }
  return chosen.map((n) => toMeta(byName.get(n)));
}

export function buildListQuery({ object, fieldNames, nameField, cursor, search, limit }) {
  const where = [];
  if (cursor) where.push(`Id > '${escapeSoql(cursor)}'`);
  if (search) where.push(`${nameField} LIKE '%${escapeLike(search)}%'`);
  return [
    `SELECT Id, ${fieldNames.join(', ')} FROM ${object}`,
    where.length ? `WHERE ${where.join(' AND ')}` : '',
    `ORDER BY Id ASC LIMIT ${limit + 1}`,
  ]
    .filter(Boolean)
    .join(' ');
}

function coerce(field, raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  if (NUMERIC.has(field.type)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new ValidationError(`${field.label} must be a number`);
    return n;
  }
  if (field.type === 'boolean') return raw === true || raw === 'true';
  if (typeof raw !== 'string') throw new ValidationError(`${field.label} is invalid`);
  if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new ValidationError(`${field.label} must be a valid date`);
  if (field.length && raw.length > field.length && field.type !== 'textarea') throw new ValidationError(`${field.label} is too long (max ${field.length})`);
  return raw;
}

// Validate and convert user input into a Salesforce request body.
export function toSfBody(values, fields, mode) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new ValidationError('Request body must be an object');
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out = {};
  for (const [name, raw] of Object.entries(values)) {
    const field = byName.get(name);
    if (!field) throw new ValidationError(`Unknown field: ${name}`);
    if (!(mode === 'create' ? field.createable : field.updateable)) throw new ValidationError(`${field.label} is read-only`);
    const value = coerce(field, raw);
    if (mode === 'create' && value === null) continue;
    out[name] = value;
  }
  if (mode === 'create') {
    for (const f of fields) if (f.required && out[f.name] == null) throw new ValidationError(`${f.label} is required`);
  } else {
    for (const f of fields) if (f.required && f.name in out && out[f.name] == null) throw new ValidationError(`${f.label} is required`);
    if (!Object.keys(out).length) throw new ValidationError('No changes to save');
  }
  return out;
}
