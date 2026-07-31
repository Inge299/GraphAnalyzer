import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { domainModelApi } from '../../services/api';
import type { DomainIngestionMapping, DomainModelConfig } from '../../types/api';

type MappingItem = Record<string, unknown>;

const emptyMapping = (): DomainIngestionMapping => ({
  id: 'new_mapping',
  label: 'Новое правило загрузки',
  source: 'source_name',
  fact: { type: 'fact_type', attributes: {} },
  entities: [],
  relations: [],
});

const emptyEntity = (): MappingItem => ({ type: 'msisdn', key: '$value', attributes: {} });
const emptyRelation = (): MappingItem => ({
  type: 'connected_to',
  directed: false,
  from: { type: 'msisdn', key: '$from_value' },
  to: { type: 'msisdn', key: '$to_value' },
  attributes: {},
});

const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const asRecord = (value: unknown): MappingItem => value && typeof value === 'object' && !Array.isArray(value) ? value as MappingItem : {};
const asArray = (value: unknown): MappingItem[] => Array.isArray(value) ? value.map(asRecord) : [];
const valueText = (value: unknown) => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
const parseValue = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { return value; }
  }
  return value;
};

export function DomainDataMappingsEditor(): React.JSX.Element {
  const [model, setModel] = useState<DomainModelConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const mappings = model?.ingestion_mappings ?? [];
  const selected = useMemo(() => mappings.find((item) => item.id === selectedId), [mappings, selectedId]);
  const draftMapping = useMemo(() => {
    try { return draft ? JSON.parse(draft) as DomainIngestionMapping : null; } catch { return null; }
  }, [draft]);
  const nodeTypes = model?.node_types ?? [];
  const edgeTypes = model?.edge_types ?? [];
  const factTypes = model?.fact_types ?? [];
  const sources = useMemo(() => [...new Set(mappings.map((item) => item.source).filter(Boolean))], [mappings]);

  const selectMapping = useCallback((item: DomainIngestionMapping) => {
    setSelectedId(item.id);
    setDraft(stringify(item));
    setMessage('');
    setError('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await domainModelApi.get();
      setModel(next);
      const first = next.ingestion_mappings?.[0];
      if (first) {
        setSelectedId(first.id);
        setDraft(stringify(first));
      } else {
        setSelectedId('');
        setDraft('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить реестр правил.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateMapping = (updater: (current: DomainIngestionMapping) => DomainIngestionMapping) => {
    if (!draftMapping) {
      setError('Сначала исправьте JSON правила.');
      return;
    }
    setError('');
    setDraft(stringify(updater(draftMapping)));
  };

  const updateEntity = (index: number, updater: (entity: MappingItem) => MappingItem) => updateMapping((current) => {
    const entities = asArray(current.entities);
    entities[index] = updater(entities[index]);
    return { ...current, entities };
  });

  const updateRelation = (index: number, updater: (relation: MappingItem) => MappingItem) => updateMapping((current) => {
    const relations = asArray(current.relations);
    relations[index] = updater(relations[index]);
    return { ...current, relations };
  });

  const handleNew = () => {
    setSelectedId('');
    setDraft(stringify(emptyMapping()));
    setMessage('');
    setError('');
  };

  const handleSave = async () => {
    if (!model) return;
    setError('');
    setMessage('');
    let parsed: DomainIngestionMapping;
    try {
      parsed = JSON.parse(draft) as DomainIngestionMapping;
    } catch {
      setError('Правило должно быть корректным JSON.');
      return;
    }
    if (!parsed.id?.trim() || !parsed.label?.trim() || !parsed.source?.trim() || !asRecord(parsed.fact).type) {
      setError('Нужны id, название, source и fact.type.');
      return;
    }
    if (!Array.isArray(parsed.entities) || !Array.isArray(parsed.relations)) {
      setError('Поля entities и relations должны быть массивами.');
      return;
    }
    setSaving(true);
    try {
      const nextMappings = mappings.filter((item) => item.id !== selectedId && item.id !== parsed.id);
      nextMappings.push(parsed);
      const next = await domainModelApi.save({ ...model, ingestion_mappings: nextMappings });
      setModel(next);
      setSelectedId(parsed.id);
      setDraft(stringify(next.ingestion_mappings?.find((item) => item.id === parsed.id) ?? parsed));
      setMessage('Правило загрузки сохранено. Следующие импорты будут использовать его.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить правило.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!model || !selected) return;
    setSaving(true);
    try {
      const next = await domainModelApi.save({ ...model, ingestion_mappings: mappings.filter((item) => item.id !== selected.id) });
      setModel(next);
      const first = next.ingestion_mappings?.[0];
      setSelectedId(first?.id ?? '');
      setDraft(first ? stringify(first) : '');
      setMessage('Правило загрузки удалено.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить правило.');
    } finally {
      setSaving(false);
    }
  };

  const entities = draftMapping ? asArray(draftMapping.entities) : [];
  const relations = draftMapping ? asArray(draftMapping.relations) : [];
  const fact = draftMapping ? asRecord(draftMapping.fact) : {};

  return (
    <section className="domain-mappings-editor">
      <div className="service-card-header">
        <div>
          <h3>Правила загрузки данных</h3>
          <p className="service-card-hint">Настройка пути: распознанная строка файла → факт → вершины → связи.</p>
        </div>
        <div className="service-row">
          <button type="button" className="service-btn" onClick={handleNew}>Новое правило</button>
          <button type="button" className="service-btn" onClick={() => void load()} disabled={loading}>{loading ? 'Обновление...' : 'Обновить'}</button>
        </div>
      </div>
      {message && <div className="service-screen-banner success">{message}</div>}
      {error && <div className="service-screen-banner error">{error}</div>}
      <div className="service-type-split domain-mappings-layout">
        <div className="service-list">
          {mappings.map((item) => (
            <button key={item.id} type="button" className={`service-list-item ${item.id === selectedId ? 'active' : ''}`} onClick={() => selectMapping(item)}>
              <strong>{item.label}</strong>
              <span>{item.source} → {String(asRecord(item.fact).type ?? '')}</span>
              <span>{item.entities.length} вершин, {item.relations.length} связей</span>
            </button>
          ))}
          {!mappings.length && <div className="service-empty">Правила пока не заданы.</div>}
        </div>
        <div className="service-editor-block">
          <div className="service-editor-header">
            <div>
              <h4>{selected ? selected.label : 'Новое правило'}</h4>
              <p>Поля со значением <code>$поле</code> берутся из распознанной строки файла.</p>
            </div>
            {selected && <button type="button" className="service-btn danger" onClick={() => void handleDelete()} disabled={saving}>Удалить</button>}
          </div>

          {draftMapping && <>
            <div className="service-form-grid domain-mapping-basics">
              <label className="service-field"><span>Ключ правила</span><input value={draftMapping.id} onChange={(event) => updateMapping((item) => ({ ...item, id: event.target.value }))} /></label>
              <label className="service-field"><span>Название</span><input value={draftMapping.label} onChange={(event) => updateMapping((item) => ({ ...item, label: event.target.value }))} /></label>
              <label className="service-field"><span>Источник строк</span><input list="domain-import-sources" value={draftMapping.source} onChange={(event) => updateMapping((item) => ({ ...item, source: event.target.value }))} /></label>
              <label className="service-field"><span>Тип факта</span><select value={String(fact.type ?? '')} onChange={(event) => updateMapping((item) => ({ ...item, fact: { ...asRecord(item.fact), type: event.target.value } }))}><option value="">Выберите тип</option>{factTypes.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.id})</option>)}</select></label>
            </div>
            <datalist id="domain-import-sources">{sources.map((source) => <option key={source} value={source} />)}</datalist>

            <section className="domain-mapping-section">
              <header><h4>Вершины, создаваемые из строки</h4><button type="button" className="service-btn" onClick={() => updateMapping((item) => ({ ...item, entities: [...asArray(item.entities), emptyEntity()] }))}>Добавить вершину</button></header>
              {entities.map((entity, index) => <div className="domain-mapping-card" key={`entity-${index}`}>
                <div className="service-form-grid">
                  <label className="service-field"><span>Тип вершины</span><select value={String(entity.type ?? '')} onChange={(event) => updateEntity(index, (current) => ({ ...current, type: event.target.value }))}><option value="">Выберите тип</option>{nodeTypes.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.id})</option>)}</select></label>
                  <label className="service-field"><span>Ключ</span><input value={valueText(entity.key)} onChange={(event) => updateEntity(index, (current) => ({ ...current, key: parseValue(event.target.value) }))} /></label>
                  <label className="service-field"><span>Подпись (необязательно)</span><input value={valueText(entity.label)} onChange={(event) => updateEntity(index, (current) => ({ ...current, label: parseValue(event.target.value) }))} /></label>
                  <label className="service-field"><span>Атрибуты</span><input value={valueText(entity.attributes)} onChange={(event) => updateEntity(index, (current) => ({ ...current, attributes: parseValue(event.target.value) }))} placeholder='{"msisdn":"$abon"}' /></label>
                </div>
                <button type="button" className="service-btn danger" onClick={() => updateMapping((item) => ({ ...item, entities: asArray(item.entities).filter((_, itemIndex) => itemIndex !== index) }))}>Удалить вершину</button>
              </div>)}
            </section>

            <section className="domain-mapping-section">
              <header><h4>Связи, создаваемые из строки</h4><button type="button" className="service-btn" onClick={() => updateMapping((item) => ({ ...item, relations: [...asArray(item.relations), emptyRelation()] }))}>Добавить связь</button></header>
              {relations.map((relation, index) => {
                const from = asRecord(relation.from);
                const to = asRecord(relation.to);
                return <div className="domain-mapping-card" key={`relation-${index}`}>
                  <div className="service-form-grid">
                    <label className="service-field"><span>Тип связи</span><select value={String(relation.type ?? '')} onChange={(event) => updateRelation(index, (current) => ({ ...current, type: event.target.value }))}><option value="">Выберите тип</option>{edgeTypes.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.id})</option>)}</select></label>
                    <label className="service-field"><span>Время факта</span><input value={valueText(relation.occurred_at)} onChange={(event) => updateRelation(index, (current) => ({ ...current, occurred_at: parseValue(event.target.value) }))} placeholder="$event_time" /></label>
                    <label className="service-field"><span>От: тип / ключ</span><div className="domain-mapping-pair"><select value={String(from.type ?? '')} onChange={(event) => updateRelation(index, (current) => ({ ...current, from: { ...asRecord(current.from), type: event.target.value } }))}>{nodeTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input value={valueText(from.key)} onChange={(event) => updateRelation(index, (current) => ({ ...current, from: { ...asRecord(current.from), key: parseValue(event.target.value) } }))} placeholder="$from" /></div></label>
                    <label className="service-field"><span>К: тип / ключ</span><div className="domain-mapping-pair"><select value={String(to.type ?? '')} onChange={(event) => updateRelation(index, (current) => ({ ...current, to: { ...asRecord(current.to), type: event.target.value } }))}>{nodeTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><input value={valueText(to.key)} onChange={(event) => updateRelation(index, (current) => ({ ...current, to: { ...asRecord(current.to), key: parseValue(event.target.value) } }))} placeholder="$to" /></div></label>
                    <label className="service-field"><span>Атрибуты</span><input value={valueText(relation.attributes)} onChange={(event) => updateRelation(index, (current) => ({ ...current, attributes: parseValue(event.target.value) }))} placeholder='{"source":"$row"}' /></label>
                    <label className="service-checkbox"><input type="checkbox" checked={Boolean(relation.directed)} onChange={(event) => updateRelation(index, (current) => ({ ...current, directed: event.target.checked }))} /> Направленная связь</label>
                  </div>
                  <button type="button" className="service-btn danger" onClick={() => updateMapping((item) => ({ ...item, relations: asArray(item.relations).filter((_, itemIndex) => itemIndex !== index) }))}>Удалить связь</button>
                </div>;
              })}
            </section>
          </>}

          <details className="domain-mapping-advanced">
            <summary>Расширенный режим: JSON правила</summary>
            <label className="service-field"><span>Полное описание</span><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={18} spellCheck={false} /></label>
          </details>
          <button type="button" className="service-btn primary" onClick={() => void handleSave()} disabled={saving || !draft}>{saving ? 'Сохранение...' : 'Сохранить правило'}</button>
        </div>
      </div>
    </section>
  );
}