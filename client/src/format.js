export function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  switch (field.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'currency':
      return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
    case 'percent':
      return `${value}%`;
    case 'double':
    case 'int':
      return Number(value).toLocaleString();
    case 'date':
      return new Date(`${value}T00:00:00`).toLocaleDateString();
    default:
      return String(value);
  }
}
