const NUMBER_TYPES = new Set(['double', 'currency', 'int', 'percent']);

export default function FieldInput({ field, value, onChange, disabled, autoFocus }) {
  const id = `f-${field.name}`;
  const common = { id, name: field.name, disabled, required: field.required, autoFocus };

  let control;
  if (field.type === 'picklist') {
    control = (
      <select {...common} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— None —</option>
        {field.picklistValues.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    );
  } else if (field.type === 'boolean') {
    control = <input {...common} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  } else if (field.type === 'textarea') {
    control = <textarea {...common} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />;
  } else {
    const type = NUMBER_TYPES.has(field.type) ? 'number' : ['date', 'email', 'url'].includes(field.type) ? field.type : field.type === 'phone' ? 'tel' : 'text';
    control = (
      <input
        {...common}
        type={type}
        step={NUMBER_TYPES.has(field.type) ? 'any' : undefined}
        maxLength={type === 'text' && field.length ? field.length : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={`field${field.type === 'boolean' ? ' field--check' : ''}${field.type === 'textarea' ? ' field--wide' : ''}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {control}
    </div>
  );
}
