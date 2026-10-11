import { Router } from 'express';
import { config } from '../config.js';
import { requireAuth } from '../middleware.js';
import { sfRequest } from '../salesforce.js';
import { OBJECTS, buildListQuery, isObjectName, isSfId, selectFields, toSfBody, ValidationError } from '../objects.js';

const router = Router();
router.use(requireAuth);

const FIELD_CACHE_MS = 30 * 60 * 1000;
const fieldCache = new Map();

function getFields(session, name) {
  const key = `${session.instanceUrl}|${name}`;
  const hit = fieldCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = sfRequest(session, `/sobjects/${name}/describe`).then((d) => selectFields(d, OBJECTS[name].preferred));
  fieldCache.set(key, { promise, expires: Date.now() + FIELD_CACHE_MS });
  promise.catch(() => fieldCache.delete(key));
  return promise;
}

router.param('name', (_req, _res, next, name) => (isObjectName(name) ? next() : next(new ValidationError('Unsupported object'))));
router.param('id', (_req, _res, next, id) => (isSfId(id) ? next() : next(new ValidationError('Invalid record id'))));

const clean = ({ attributes: _attributes, ...rest }) => rest;

router.get('/me', (req, res) => res.json({ user: req.sf.user }));

router.get('/objects', (_req, res) => res.json(Object.entries(OBJECTS).map(([name, o]) => ({ name, label: o.label }))));

router.get('/objects/:name', async (req, res) => {
  const { name } = req.params;
  res.json({ name, label: OBJECTS[name].label, nameField: OBJECTS[name].nameField, fields: await getFields(req.sf, name) });
});

router.get('/objects/:name/records', async (req, res) => {
  const { name } = req.params;
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : null;
  if (cursor && !isSfId(cursor)) throw new ValidationError('Invalid cursor');
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  const fields = await getFields(req.sf, name);
  const soql = buildListQuery({ object: name, fieldNames: fields.map((f) => f.name), nameField: OBJECTS[name].nameField, cursor, search, limit: config.pageSize });
  const data = await sfRequest(req.sf, `/query?q=${encodeURIComponent(soql)}`);
  const rows = data.records.slice(0, config.pageSize).map(clean);
  const hasMore = data.records.length > config.pageSize;
  res.json({ records: rows, hasMore, nextCursor: hasMore ? rows.at(-1).Id : null });
});

router.get('/objects/:name/records/:id', async (req, res) => {
  const { name, id } = req.params;
  const fields = await getFields(req.sf, name);
  const record = await sfRequest(req.sf, `/sobjects/${name}/${id}?fields=${fields.map((f) => f.name).join(',')}`);
  res.json(clean({ Id: id, ...record }));
});

router.post('/objects/:name/records', async (req, res) => {
  const { name } = req.params;
  const body = toSfBody(req.body, await getFields(req.sf, name), 'create');
  const created = await sfRequest(req.sf, `/sobjects/${name}`, { method: 'POST', body });
  res.status(201).json({ id: created.id });
});

router.patch('/objects/:name/records/:id', async (req, res) => {
  const { name, id } = req.params;
  const body = toSfBody(req.body, await getFields(req.sf, name), 'update');
  await sfRequest(req.sf, `/sobjects/${name}/${id}`, { method: 'PATCH', body });
  res.status(204).end();
});

router.delete('/objects/:name/records/:id', async (req, res) => {
  const { name, id } = req.params;
  await sfRequest(req.sf, `/sobjects/${name}/${id}`, { method: 'DELETE' });
  res.status(204).end();
});

export default router;
