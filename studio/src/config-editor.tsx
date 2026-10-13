import React from 'react';
import { ChangeIndicator, hasChangedOverride } from './change-indicator.tsx';
import { Button, SectionHead } from './ui.tsx';

export interface ConfigEditorProps {
  entries: Array<{ id: string; name: string; schema?: Record<string, unknown>; config?: unknown; error?: string }>;
  value: Record<string, Record<string, unknown>>;
  onChange(value: Record<string, Record<string, unknown>>): void;
  locale: string;
}
type Schema = Record<string, unknown>;
const copy = {
  en: { available: 'Available Configs', selected: 'Selected Configs', add: 'Add', remove: 'Remove', reset: 'Reset override', empty: 'No Configs', unavailable: 'Schema unavailable; editing is disabled.', inherited: 'Base value (not overridden)', overridden: 'Override', unset: 'Not set', unsupported: 'This schema type is not yet supported by the form. Existing values are preserved; remove the Config to reset them.', json: 'Config', invalid: 'Enter valid JSON.', object: 'Enter a JSON object.', number: 'Enter a valid number.', hint: 'Selecting a Config does not save its defaults. Only edited fields are overridden.' },
  ko: { available: '사용 가능한 Config', selected: '선택한 Config', add: '추가', remove: '제외', reset: '덮어쓰기 초기화', empty: 'Config 없음', unavailable: '스키마를 사용할 수 없어 편집할 수 없습니다.', inherited: '기본값 (덮어쓰기 없음)', overridden: '덮어쓰기', unset: '미설정', unsupported: '아직 폼으로 지원하지 않는 설정입니다. 기존 값은 유지되며 Config를 제외하면 초기화됩니다.', json: 'Config', invalid: '올바른 JSON을 입력하세요.', object: 'JSON 객체를 입력하세요.', number: '올바른 숫자를 입력하세요.', hint: 'Config를 선택해도 기본값은 저장되지 않습니다. 편집한 필드만 덮어씁니다.' },
  zh: { available: '可用 Config', selected: '已选 Config', add: '添加', remove: '移除', reset: '重置覆盖', empty: '没有 Config', unavailable: '架构不可用，无法编辑', inherited: '基础值（未覆盖）', overridden: '覆盖', unset: '未设置', unsupported: '表单暂不支持此设置类型。保留现有值；移除 Config 可重置。', json: 'Config', invalid: '请输入有效的 JSON', object: '请输入 JSON 对象', number: '请输入有效的数字', hint: '选择 Config 不会保存默认值，只覆盖已编辑的字段' },
};
type Labels = typeof copy.en;
const own = (value: unknown, key: string) => isObject(value) && Object.hasOwn(value, key);
function isObject(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function at(value: unknown, path: string[]): unknown { return path.reduce<unknown>((node, key) => own(node, key) ? (node as Schema)[key] : undefined, value); }
function has(value: unknown, path: string[]): boolean { return path.length === 0 || own(at(value, path.slice(0, -1)), path[path.length - 1]!); }
/** Copy only the edited branch; resetting its last leaf prunes empty ancestors. */
function update(value: Schema, path: string[], next: unknown, reset = false): Schema {
  if (!path.length) return isObject(next) ? next : {};
  const [key, ...rest] = path as [string, ...string[]];
  const result = { ...value };
  if (rest.length) {
    const child = update(isObject(value[key]) ? value[key] : {}, rest, next, reset);
    if (reset && !Object.keys(child).length) delete result[key];
    else Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
  } else if (reset) delete result[key];
  else Object.defineProperty(result, key, { value: next, enumerable: true, writable: true, configurable: true });
  return result;
}
function merged(base: unknown, override: unknown): unknown {
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override;
  return Object.fromEntries([...new Set([...Object.keys(base), ...Object.keys(override)])].map(key => [key, own(override, key) ? merged(base[key], override[key]) : base[key]]));
}
function resolve(schema: Schema, root: Schema): Schema {
  const seen = new Set<string>();
  while (typeof schema.$ref === 'string') {
    const ref = schema.$ref;
    if (!ref.startsWith('#/') || seen.has(ref)) return schema;
    seen.add(ref);
    const target = at(root, ref.slice(2).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~')));
    if (!isObject(target)) return schema;
    const { $ref: _, ...siblings } = schema;
    schema = { ...target, ...siblings };
  }
  return schema;
}

function Field({ schema: raw, root, path, base, override, change, labels, entryId, depth = 0, locked = false }: {
  schema: Schema; root: Schema; path: string[]; base: unknown; override: Schema;
  change(path: string[], value: unknown, reset?: boolean): void; labels: Labels; entryId: string; depth?: number; locked?: boolean;
}) {
  let schema = resolve(raw, root);
  const inherited = merged(at(base, path), at(override, path));
  // Public projector wraps literal values in a Loader-expression union, including
  // the root object. Only unwrap that known union, never arbitrary alternatives.
  const expression = isObject(inherited) && own(inherited, '__jsExpr');
  if (!expression && Array.isArray(schema.anyOf)) {
    const literal = schema.anyOf.filter(branch => !isObject(branch) || branch.$ref !== '#/$defs/loaderExpression');
    if (literal.length === 1 && literal.length < schema.anyOf.length && isObject(literal[0])) {
      const { anyOf: _, ...metadata } = schema;
      schema = { ...resolve(literal[0], root), ...metadata };
    }
  }
  if (inherited !== null && Array.isArray(schema.type)) {
    const types = schema.type.filter(type => type !== 'null');
    if (types.length === 1) schema = { ...schema, type: types[0] };
  }
  const disabled = locked || schema.readOnly === true;
  const overridden = path.length > 0 && has(override, path);
  const current = inherited === undefined ? schema.default : inherited;
  const label = `${entryId}: ${path.length ? path.join('.') : labels.json}`;
  const id = React.useId();
  const complex = ['$ref', 'oneOf', 'anyOf', 'allOf', 'if', 'not'].some(key => own(schema, key)) || Array.isArray(schema.type) || depth > 16;
  const properties = isObject(schema.properties) ? schema.properties : undefined;
  const object = !complex && (schema.type === 'object' || properties !== undefined);
  const reset = overridden && <Button small disabled={disabled} aria-label={`${labels.reset}: ${label}`} onClick={() => change(path, undefined, true)}>{labels.reset}</Button>;
  if (object && properties) return <fieldset disabled={disabled}>
    {path.length > 0 && <legend>{typeof schema.title === 'string' ? schema.title : path[path.length - 1]}</legend>}
    {typeof schema.description === 'string' && <p className="studio-muted">{schema.description}</p>}
    {reset}
    {Object.entries(properties).map(([key, child]) => <Field key={key} schema={isObject(child) ? child : { readOnly: child === false }} root={root} path={[...path, key]} base={base} override={override} change={change} labels={labels} entryId={entryId} depth={depth + 1} locked={disabled} />)}

  </fieldset>;
  let input: React.ReactNode;
  if (!complex && Array.isArray(schema.enum)) {
    const choices = schema.enum;
    const selected = choices.findIndex(item => JSON.stringify(item) === JSON.stringify(current));
    input = <select id={id} aria-label={label} value={String(selected)} disabled={disabled} onChange={event => change(path, choices[Number(event.target.value)])}>
      <option value="-1" disabled>{current === undefined ? labels.unset : JSON.stringify(current)}</option>
      {choices.map((item, index) => <option key={index} value={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</option>)}
    </select>;
  } else if (!complex && schema.type === 'boolean') {
    input = <select id={id} aria-label={label} value={typeof current === 'boolean' ? String(current) : ''} disabled={disabled} onChange={event => change(path, event.target.value === 'true')}>
      <option value="" disabled>{labels.unset}</option><option value="true">true</option><option value="false">false</option>
    </select>;
  } else if (!complex && (schema.type === 'number' || schema.type === 'integer')) {
    input = <input id={id} aria-label={label} type="number" disabled={disabled} value={typeof current === 'number' ? current : ''} step={schema.type === 'integer' ? 1 : 'any'} min={typeof schema.minimum === 'number' ? schema.minimum : undefined} max={typeof schema.maximum === 'number' ? schema.maximum : undefined} onChange={event => {
      const number = event.target.valueAsNumber;
      if (Number.isFinite(number) && (schema.type !== 'integer' || Number.isInteger(number))) { event.target.setCustomValidity(''); change(path, number); }
      else event.target.setCustomValidity(labels.number);
    }} />;
  } else if (!complex && schema.type === 'string') {
    input = <input id={id} aria-label={label} type={schema.format === 'password' || schema.writeOnly === true ? 'password' : 'text'} disabled={disabled} value={typeof current === 'string' ? current : ''} onChange={event => change(path, event.target.value)} />;
  } else input = <p role="status" aria-label={label}>{labels.unsupported}</p>;
  return <div className="studio-field">
    <label htmlFor={id}>{typeof schema.title === 'string' ? schema.title : path[path.length - 1] ?? labels.json}</label>
    {typeof schema.description === 'string' && <span className="studio-muted">{schema.description}</span>}
    <span className="studio-schema-meta">{overridden ? labels.overridden : labels.inherited}</span>
    {input}{reset}
  </div>;
}

function comparisonBase(raw: Schema | undefined, root: Schema | undefined, base: unknown, depth = 0): unknown {
  if (!raw || !root || depth > 16) return base;
  let schema = resolve(raw, root);
  if (Array.isArray(schema.anyOf)) {
    const literal = schema.anyOf.filter(branch => !isObject(branch) || branch.$ref !== '#/$defs/loaderExpression');
    if (literal.length === 1 && literal.length < schema.anyOf.length && isObject(literal[0])) schema = resolve(literal[0], root);
  }
  const value = base === undefined ? schema.default : base;
  if (isObject(schema.properties) && (value === undefined || isObject(value))) {
    return { ...(isObject(value) ? value : {}), ...Object.fromEntries(Object.entries(schema.properties).filter(([, child]) => isObject(child)).map(([key, child]) => [key, comparisonBase(child as Schema, root, isObject(value) ? value[key] : undefined, depth + 1)])) };
  }
  return value;
}

/** Config selection is key presence; an empty override intentionally keeps a Config selected. */
export function ConfigEditor({ entries, value, onChange, locale }: ConfigEditorProps) {
  const labels = copy[locale.startsWith('ko') ? 'ko' : locale.startsWith('zh') ? 'zh' : 'en'];
  const [query, setQuery] = React.useState('');
  const text = locale.startsWith('ko') ? { search: '실행 설정 검색', hint: '플러그인 이름, 설정 필드 또는 설명으로 검색', empty: '검색 결과가 없습니다.' } : locale.startsWith('zh') ? { search: '搜索执行设置', hint: '按插件名称、配置字段或描述搜索', empty: '没有匹配结果。' } : { search: 'Search execution settings', hint: 'Search plugin names, config fields or descriptions', empty: 'No matching results.' };
  const available = entries.filter(entry => !own(value, entry.id) && `${entry.id}\n${entry.name}\n${JSON.stringify(entry.schema ?? {})}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = Object.keys(value).map(id => entries.find(entry => entry.id === id) ?? { id, name: id });
  const remove = (id: string) => { const next = { ...value }; delete next[id]; onChange(next); };
  return <div>
    <p className="studio-muted">{labels.hint}</p>
    <label className="studio-field"><span>{text.search}</span><input type="search" value={query} placeholder={text.hint} onChange={event => setQuery(event.target.value)} /></label>
    <div className="studio-comparison-grid">
      <section className="studio-transfer-column" aria-label={labels.available}>
        <SectionHead title={labels.available} />
        <div className="studio-transfer-items">{!available.length && <p className="studio-muted" role="status">{query.trim() ? text.empty : labels.empty}</p>}{available.map(entry => <div className="studio-card" key={entry.id}>
          <SectionHead title={entry.name} description={entry.id} actions={<Button small disabled={!!entry.error || !entry.schema} aria-label={`${labels.add}: ${entry.id}`} onClick={() => onChange({ ...value, [entry.id]: {} })}>{labels.add}</Button>} />
          {(entry.error || !entry.schema) && <p className="studio-muted">{entry.error || labels.unavailable}</p>}
        </div>)}</div>
      </section>
      <section className="studio-transfer-column" aria-label={labels.selected}>
        <SectionHead title={labels.selected} />
        {!selected.length && <p className="studio-muted">{labels.empty}</p>}
        {selected.map(entry => <div className="studio-card" key={entry.id}>
          <SectionHead title={entry.name} description={entry.id} actions={<>{hasChangedOverride(comparisonBase(entry.schema, entry.schema, entry.config), value[entry.id]) && <ChangeIndicator locale={locale} />}<Button small aria-label={`${labels.remove}: ${entry.id}`} onClick={() => remove(entry.id)}>{labels.remove}</Button></>} />
          {entry.error || !entry.schema ? <p role="status" className="studio-muted">{entry.error || labels.unavailable}</p> : <Field schema={entry.schema} root={entry.schema} path={[]} base={entry.config} override={value[entry.id]!} entryId={entry.id} labels={labels} change={(path, next, reset) => onChange({ ...value, [entry.id]: update(value[entry.id]!, path, next, reset) })} />}
        </div>)}
      </section>
    </div>
  </div>;
}
