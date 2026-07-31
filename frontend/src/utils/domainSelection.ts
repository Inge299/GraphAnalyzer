import type { SelectedDomainEntity } from '../types/api';

const asText = (value: unknown): string => String(value ?? '').trim();

const asAttributes = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};

export const selectedEntityFromGraphNode = (node: unknown): SelectedDomainEntity | null => {
  const source = asAttributes(node);
  const attributes = asAttributes(source.attributes);
  const type_id = asText(source.type || source.type_id || attributes.type_id);
  const external_key = asText(
    source.external_key
    || attributes.external_key
    || source.label
    || attributes.label
    || attributes.name,
  );
  if (!type_id || !external_key) return null;
  return {
    type_id,
    external_key,
    label: asText(source.label || attributes.label || external_key) || undefined,
    attributes,
    source: 'graph',
  };
};

export const selectedEntityFromRow = (row: unknown): SelectedDomainEntity | null => {
  const source = asAttributes(row);
  const type_id = asText(source.type_id || source.entity_type || source.domain_type);
  const external_key = asText(
    source.external_key
    || source.entity_key
    || source.identifier
    || source.entity_identifier,
  );
  if (!type_id || !external_key) return null;
  return {
    type_id,
    external_key,
    label: asText(source.label || source.entity_label || external_key) || undefined,
    attributes: source,
    source: 'row',
  };
};

export const uniqueSelectedDomainEntities = (items: Array<SelectedDomainEntity | null | undefined>): SelectedDomainEntity[] => {
  const result: SelectedDomainEntity[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item) continue;
    const key = item.type_id.trim().toLowerCase() + '|' + item.external_key.trim().toLowerCase();
    if (!item.type_id.trim() || !item.external_key.trim() || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};