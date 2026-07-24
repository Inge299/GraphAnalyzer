import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { domainModelApi } from '../../services/api';
import type { DomainAttributeDefinition, DomainEdgeType, DomainNodeType } from '../../types/api';

interface GraphDomainEditorProps {
  compact?: boolean;
}

interface DomainAttributeFormItem {
  id: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  multiline: boolean;
}

interface DomainNodeTypeForm {
  id: string;
  label: string;
  icon: string;
  color: string;
  iconScale: string;
  ringEnabled: boolean;
  ringWidth: string;
  attributes: DomainAttributeFormItem[];
}

interface DomainEdgeTypeForm {
  id: string;
  label: string;
  directed: boolean;
  allowed_from: string[];
  allowed_to: string[];
  color: string;
  width: string;
  direction: string;
  dashed: boolean;
  plugin_id: string;
  show_in_context_menu: boolean;
  context_menu_section: string;
  context_menu_label: string;
  menu_order: string;
  attributes: DomainAttributeFormItem[];
}

const attributeTypeOptions = [
  { value: 'string', label: 'Строка' },
  { value: 'number', label: 'Число' },
  { value: 'integer', label: 'Целое число' },
  { value: 'boolean', label: 'Булево' },
  { value: 'date', label: 'Дата' },
  { value: 'datetime', label: 'Дата и время' },
  { value: 'json', label: 'JSON' },
];

const edgeDirectionOptions = [
  { value: 'from', label: 'От источника' },
  { value: 'to', label: 'К цели' },
  { value: 'both', label: 'Двунаправленная' },
];

const defaultNodeIconOptions = [
  'person_phone',
  'smartphone',
  'imsi',
  'ip_address',
  'mail',
  'social',
  'passport',
  'car',
  'address',
  'location',
  'bank_card',
  'id',
  'device',
  'document',
  'message',
  'file_text',
  'badge',
  'circle',
];

const createLocalId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDefaultAttribute = (): DomainAttributeFormItem => ({
  id: createLocalId('domain-attr'),
  key: '',
  label: '',
  type: 'string',
  required: false,
  multiline: false,
});

const createDefaultNodeTypeForm = (): DomainNodeTypeForm => ({
  id: '',
  label: '',
  icon: '',
  color: '#475569',
  iconScale: '1.9',
  ringEnabled: false,
  ringWidth: '1.5',
  attributes: [],
});

const createDefaultEdgeTypeForm = (): DomainEdgeTypeForm => ({
  id: '',
  label: '',
  directed: false,
  allowed_from: [],
  allowed_to: [],
  color: '#475569',
  width: '2',
  direction: 'both',
  dashed: false,
  plugin_id: '',
  show_in_context_menu: false,
  context_menu_section: 'Связи',
  context_menu_label: '',
  menu_order: '0',
  attributes: [],
});

const mapAttributeToForm = (attribute: DomainAttributeDefinition): DomainAttributeFormItem => ({
  id: createLocalId('domain-attr'),
  key: String(attribute.key || '').trim(),
  label: String(attribute.label || attribute.key || '').trim(),
  type: String(attribute.type || 'string').trim() || 'string',
  required: Boolean(attribute.required),
  multiline: Boolean(attribute.multiline),
});

const mapNodeTypeToForm = (nodeType: DomainNodeType): DomainNodeTypeForm => ({
  id: String(nodeType.id || '').trim(),
  label: String(nodeType.label || nodeType.id || '').trim(),
  icon: String(nodeType.icon || nodeType.id || '').trim(),
  color: String(nodeType.default_visual?.color || '#475569'),
  iconScale: String(nodeType.default_visual?.iconScale ?? 1.9),
  ringEnabled: Boolean(nodeType.default_visual?.ringEnabled),
  ringWidth: String(nodeType.default_visual?.ringWidth ?? 1.5),
  attributes: Array.isArray(nodeType.attributes) ? nodeType.attributes.map(mapAttributeToForm) : [],
});

const mapEdgeTypeToForm = (edgeType: DomainEdgeType): DomainEdgeTypeForm => ({
  id: String(edgeType.id || '').trim(),
  label: String(edgeType.label || edgeType.id || '').trim(),
  directed: Boolean(edgeType.directed),
  allowed_from: Array.isArray(edgeType.allowed_from) ? edgeType.allowed_from.map((item) => String(item).trim()).filter(Boolean) : [],
  allowed_to: Array.isArray(edgeType.allowed_to) ? edgeType.allowed_to.map((item) => String(item).trim()).filter(Boolean) : [],
  color: String(edgeType.default_visual?.color || '#475569'),
  width: String(edgeType.default_visual?.width ?? 2),
  direction: String(edgeType.default_visual?.direction || (edgeType.directed ? 'to' : 'both')),
  dashed: Boolean(edgeType.default_visual?.dashed),
  plugin_id: String(edgeType.plugin_id || ''),
  show_in_context_menu: Boolean(edgeType.show_in_context_menu),
  context_menu_section: String(edgeType.context_menu_section || 'Связи'),
  context_menu_label: String(edgeType.context_menu_label || ''),
  menu_order: String(edgeType.menu_order ?? 0),
  attributes: Array.isArray(edgeType.attributes) ? edgeType.attributes.map(mapAttributeToForm) : [],
});

const buildAttributePayload = (items: DomainAttributeFormItem[]): DomainAttributeDefinition[] =>
  items
    .map((item) => {
      const key = item.key.trim();
      if (!key) return null;
      return {
        key,
        label: item.label.trim() || key,
        type: item.type.trim() || 'string',
        required: item.required,
        multiline: item.multiline,
      };
    })
    .filter(Boolean) as DomainAttributeDefinition[];

const buildNodeTypePayload = (form: DomainNodeTypeForm): DomainNodeType => ({
  id: form.id.trim(),
  label: form.label.trim() || form.id.trim(),
  icon: form.icon.trim() || form.id.trim() || 'circle',
  default_visual: {
    color: form.color.trim() || '#475569',
    iconScale: Number.parseFloat(form.iconScale) || 1.9,
    ringEnabled: form.ringEnabled,
    ringWidth: Number.parseFloat(form.ringWidth) || 1.5,
  },
  attributes: buildAttributePayload(form.attributes),
});

const buildEdgeTypePayload = (form: DomainEdgeTypeForm): DomainEdgeType => ({
  id: form.id.trim(),
  label: form.label.trim() || form.id.trim(),
  directed: form.directed,
  allowed_from: form.allowed_from.map((item) => item.trim()).filter(Boolean),
  allowed_to: form.allowed_to.map((item) => item.trim()).filter(Boolean),
  default_visual: {
    color: form.color.trim() || '#475569',
    width: Number.parseFloat(form.width) || 2,
    direction: form.direction || 'both',
    dashed: form.dashed,
  },
  plugin_id: form.plugin_id.trim() || undefined,
  show_in_context_menu: form.show_in_context_menu,
  context_menu_section: form.context_menu_section.trim() || undefined,
  context_menu_label: form.context_menu_label.trim() || undefined,
  menu_order: Number.parseInt(form.menu_order, 10) || 0,
  attributes: buildAttributePayload(form.attributes),
});

const GraphDomainEditor: React.FC<GraphDomainEditorProps> = () => {
  const [nodeTypes, setNodeTypes] = useState<DomainNodeType[]>([]);
  const [edgeTypes, setEdgeTypes] = useState<DomainEdgeType[]>([]);
  const [selectedNodeTypeId, setSelectedNodeTypeId] = useState('');
  const [selectedEdgeTypeId, setSelectedEdgeTypeId] = useState('');
  const [nodeTypeForm, setNodeTypeForm] = useState<DomainNodeTypeForm>(createDefaultNodeTypeForm);
  const [edgeTypeForm, setEdgeTypeForm] = useState<DomainEdgeTypeForm>(createDefaultEdgeTypeForm);
  const [loading, setLoading] = useState(false);
  const [nodeSaving, setNodeSaving] = useState(false);
  const [edgeSaving, setEdgeSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDomainModel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nodeTypesResponse, edgeTypesResponse] = await Promise.all([
        domainModelApi.listNodeTypes(),
        domainModelApi.listEdgeTypes(),
      ]);
      setNodeTypes(nodeTypesResponse);
      setEdgeTypes(edgeTypesResponse);
      if (!selectedNodeTypeId && nodeTypesResponse[0]?.id) {
        setSelectedNodeTypeId(nodeTypesResponse[0].id);
      }
      if (!selectedEdgeTypeId && edgeTypesResponse[0]?.id) {
        setSelectedEdgeTypeId(edgeTypesResponse[0].id);
      }
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось загрузить типы графа'));
    } finally {
      setLoading(false);
    }
  }, [selectedEdgeTypeId, selectedNodeTypeId]);

  useEffect(() => {
    void loadDomainModel();
  }, [loadDomainModel]);

  const selectedNodeType = useMemo(
    () => nodeTypes.find((item) => item.id === selectedNodeTypeId) || null,
    [nodeTypes, selectedNodeTypeId],
  );

  const selectedEdgeType = useMemo(
    () => edgeTypes.find((item) => item.id === selectedEdgeTypeId) || null,
    [edgeTypes, selectedEdgeTypeId],
  );

  useEffect(() => {
    setNodeTypeForm(selectedNodeType ? mapNodeTypeToForm(selectedNodeType) : createDefaultNodeTypeForm());
  }, [selectedNodeType]);

  useEffect(() => {
    setEdgeTypeForm(selectedEdgeType ? mapEdgeTypeToForm(selectedEdgeType) : createDefaultEdgeTypeForm());
  }, [selectedEdgeType]);

  const nodeTypeIds = useMemo(() => nodeTypes.map((item) => item.id).filter(Boolean), [nodeTypes]);

  const menuPreview = useMemo(() => {
    if (!edgeTypeForm.show_in_context_menu) return 'Не показывается в контекстном меню';
    const section = edgeTypeForm.context_menu_section.trim() || 'Связи';
    const label = edgeTypeForm.context_menu_label.trim() || edgeTypeForm.label.trim() || edgeTypeForm.id.trim() || 'Новая связь';
    return `${section} -> ${label}`;
  }, [edgeTypeForm]);

  const handleResetNodeTypeForm = useCallback(() => {
    setSelectedNodeTypeId('');
    setNodeTypeForm(createDefaultNodeTypeForm());
  }, []);

  const handleResetEdgeTypeForm = useCallback(() => {
    setSelectedEdgeTypeId('');
    setEdgeTypeForm(createDefaultEdgeTypeForm());
  }, []);

  const handleSaveNodeType = useCallback(async () => {
    const payload = buildNodeTypePayload(nodeTypeForm);
    if (!payload.id) {
      setError('У типа вершины должен быть задан ключ');
      return;
    }
    setNodeSaving(true);
    setError(null);
    setMessage(null);
    try {
      const model = await domainModelApi.saveNodeType(payload);
      setNodeTypes(Array.isArray(model.node_types) ? model.node_types : []);
      setEdgeTypes(Array.isArray(model.edge_types) ? model.edge_types : []);
      setSelectedNodeTypeId(payload.id);
      setMessage(`Тип вершины «${payload.label}» сохранён`);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить тип вершины'));
    } finally {
      setNodeSaving(false);
    }
  }, [nodeTypeForm]);

  const handleSaveEdgeType = useCallback(async () => {
    const payload = buildEdgeTypePayload(edgeTypeForm);
    if (!payload.id) {
      setError('У типа связи должен быть задан ключ');
      return;
    }
    setEdgeSaving(true);
    setError(null);
    setMessage(null);
    try {
      const model = await domainModelApi.saveEdgeType(payload);
      setNodeTypes(Array.isArray(model.node_types) ? model.node_types : []);
      setEdgeTypes(Array.isArray(model.edge_types) ? model.edge_types : []);
      setSelectedEdgeTypeId(payload.id);
      setMessage(`Тип связи «${payload.label}» сохранён`);
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось сохранить тип связи'));
    } finally {
      setEdgeSaving(false);
    }
  }, [edgeTypeForm]);

  const handleDeleteNodeType = useCallback(async () => {
    if (!selectedNodeTypeId) return;
    if (!window.confirm(`Удалить тип вершины «${selectedNodeType?.label || selectedNodeTypeId}»?`)) return;
    setNodeSaving(true);
    setError(null);
    setMessage(null);
    try {
      const model = await domainModelApi.deleteNodeType(selectedNodeTypeId);
      const nextNodeTypes = Array.isArray(model.node_types) ? model.node_types : [];
      setNodeTypes(nextNodeTypes);
      setEdgeTypes(Array.isArray(model.edge_types) ? model.edge_types : []);
      setSelectedNodeTypeId(nextNodeTypes[0]?.id || '');
      setMessage('Тип вершины удалён');
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось удалить тип вершины'));
    } finally {
      setNodeSaving(false);
    }
  }, [selectedNodeType, selectedNodeTypeId]);

  const handleDeleteEdgeType = useCallback(async () => {
    if (!selectedEdgeTypeId) return;
    if (!window.confirm(`Удалить тип связи «${selectedEdgeType?.label || selectedEdgeTypeId}»?`)) return;
    setEdgeSaving(true);
    setError(null);
    setMessage(null);
    try {
      const model = await domainModelApi.deleteEdgeType(selectedEdgeTypeId);
      const nextEdgeTypes = Array.isArray(model.edge_types) ? model.edge_types : [];
      setNodeTypes(Array.isArray(model.node_types) ? model.node_types : []);
      setEdgeTypes(nextEdgeTypes);
      setSelectedEdgeTypeId(nextEdgeTypes[0]?.id || '');
      setMessage('Тип связи удалён');
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || err?.message || 'Не удалось удалить тип связи'));
    } finally {
      setEdgeSaving(false);
    }
  }, [selectedEdgeType, selectedEdgeTypeId]);

  const updateNodeAttribute = useCallback((attributeId: string, patch: Partial<DomainAttributeFormItem>) => {
    setNodeTypeForm((prev) => ({
      ...prev,
      attributes: prev.attributes.map((item) => (item.id === attributeId ? { ...item, ...patch } : item)),
    }));
  }, []);

  const updateEdgeAttribute = useCallback((attributeId: string, patch: Partial<DomainAttributeFormItem>) => {
    setEdgeTypeForm((prev) => ({
      ...prev,
      attributes: prev.attributes.map((item) => (item.id === attributeId ? { ...item, ...patch } : item)),
    }));
  }, []);

  const addNodeAttribute = useCallback(() => {
    setNodeTypeForm((prev) => ({ ...prev, attributes: [...prev.attributes, createDefaultAttribute()] }));
  }, []);

  const addEdgeAttribute = useCallback(() => {
    setEdgeTypeForm((prev) => ({ ...prev, attributes: [...prev.attributes, createDefaultAttribute()] }));
  }, []);

  const removeNodeAttribute = useCallback((attributeId: string) => {
    setNodeTypeForm((prev) => ({ ...prev, attributes: prev.attributes.filter((item) => item.id !== attributeId) }));
  }, []);

  const removeEdgeAttribute = useCallback((attributeId: string) => {
    setEdgeTypeForm((prev) => ({ ...prev, attributes: prev.attributes.filter((item) => item.id !== attributeId) }));
  }, []);

  const toggleAllowedType = useCallback((kind: 'from' | 'to', nodeTypeId: string) => {
    setEdgeTypeForm((prev) => {
      const key = kind === 'from' ? 'allowed_from' : 'allowed_to';
      const current = prev[key];
      const next = current.includes(nodeTypeId)
        ? current.filter((item) => item !== nodeTypeId)
        : [...current, nodeTypeId];
      return { ...prev, [key]: next };
    });
  }, []);

  return (
    <div className="service-summary-block">
      {message && <div className="service-screen-banner success">{message}</div>}
      {error && <div className="service-screen-banner error">{error}</div>}

      <div className="service-console-grid">
        <div className="service-card">
          <div className="service-card-header">
            <div>
              <h3>Типы вершин</h3>
              <p className="service-card-hint">
                Здесь задаём доменные типы узлов, их подписи, иконки, цвет и поддерживаемые атрибуты.
              </p>
            </div>
            <div className="service-row">
              <button type="button" className="service-btn" onClick={handleResetNodeTypeForm}>Новый тип</button>
              <button type="button" className="service-btn" onClick={() => void loadDomainModel()} disabled={loading}>
                {loading ? 'Обновление...' : 'Обновить'}
              </button>
            </div>
          </div>

          <div className="service-type-split">
            <div className="service-list">
              {nodeTypes.map((nodeType) => (
                <button
                  key={nodeType.id}
                  type="button"
                  className={`service-list-item ${selectedNodeTypeId === nodeType.id ? 'active' : ''}`}
                  onClick={() => setSelectedNodeTypeId(nodeType.id)}
                >
                  <strong>{nodeType.label}</strong>
                  <span>{nodeType.id}</span>
                  <span>{nodeType.attributes.length} атр.</span>
                </button>
              ))}
              {!nodeTypes.length && <div className="service-empty">Типы вершин пока не заданы.</div>}
            </div>

            <div className="service-editor-block">
              <div className="service-editor-header">
                <div>
                  <h4>{selectedNodeTypeId ? 'Редактирование типа вершины' : 'Новый тип вершины'}</h4>
                  <p>Ключ используем в плагинах и правилах графа, а визуал сразу пойдёт в рендер узлов.</p>
                </div>
                {selectedNodeTypeId && (
                  <button type="button" className="service-btn danger" onClick={() => void handleDeleteNodeType()} disabled={nodeSaving}>
                    Удалить
                  </button>
                )}
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>Ключ</span>
                  <input className="service-input" value={nodeTypeForm.id} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, id: event.target.value }))} placeholder="msisdn" />
                </label>
                <label className="service-field">
                  <span>Название</span>
                  <input className="service-input" value={nodeTypeForm.label} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="MSISDN" />
                </label>
                <label className="service-field">
                  <span>Иконка</span>
                  <input className="service-input" list="domain-node-icons" value={nodeTypeForm.icon} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, icon: event.target.value }))} placeholder="circle" />
                </label>
                <label className="service-field">
                  <span>Цвет</span>
                  <div className="service-color-row">
                    <input className="service-color-input" type="color" value={nodeTypeForm.color} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, color: event.target.value }))} />
                    <input className="service-input" value={nodeTypeForm.color} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, color: event.target.value }))} />
                  </div>
                </label>
                <label className="service-field">
                  <span>Масштаб иконки</span>
                  <input className="service-input" value={nodeTypeForm.iconScale} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, iconScale: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Толщина кольца</span>
                  <input className="service-input" value={nodeTypeForm.ringWidth} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, ringWidth: event.target.value }))} />
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={nodeTypeForm.ringEnabled} onChange={(event) => setNodeTypeForm((prev) => ({ ...prev, ringEnabled: event.target.checked }))} />
                  <span>Показывать кольцо вокруг иконки</span>
                </label>
              </div>

              <div className="service-editor-header">
                <div>
                  <h4>Атрибуты вершины</h4>
                  <p>Опиши поля, которые чаще всего будут жить у узлов этого типа.</p>
                </div>
                <button type="button" className="service-btn" onClick={addNodeAttribute}>Добавить атрибут</button>
              </div>

              {nodeTypeForm.attributes.length ? (
                <div className="service-editor-list">
                  {nodeTypeForm.attributes.map((attribute) => (
                    <div key={attribute.id} className="service-editor-card">
                      <div className="service-editor-card-header">
                        <strong>{attribute.label || attribute.key || 'Новый атрибут'}</strong>
                        <button type="button" className="service-btn danger" onClick={() => removeNodeAttribute(attribute.id)}>Удалить</button>
                      </div>
                      <div className="service-column-grid">
                        <label className="service-field">
                          <span>Ключ</span>
                          <input className="service-input" value={attribute.key} onChange={(event) => updateNodeAttribute(attribute.id, { key: event.target.value })} placeholder="msisdn" />
                        </label>
                        <label className="service-field">
                          <span>Название</span>
                          <input className="service-input" value={attribute.label} onChange={(event) => updateNodeAttribute(attribute.id, { label: event.target.value })} placeholder="Телефон" />
                        </label>
                        <label className="service-field">
                          <span>Тип</span>
                          <select className="service-input" value={attribute.type} onChange={(event) => updateNodeAttribute(attribute.id, { type: event.target.value })}>
                            {attributeTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="service-checkbox">
                          <input type="checkbox" checked={attribute.required} onChange={(event) => updateNodeAttribute(attribute.id, { required: event.target.checked })} />
                          <span>Обязательный</span>
                        </label>
                        <label className="service-checkbox">
                          <input type="checkbox" checked={attribute.multiline} onChange={(event) => updateNodeAttribute(attribute.id, { multiline: event.target.checked })} />
                          <span>Многострочное поле</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="service-empty">У этого типа вершины пока нет описанных атрибутов.</div>
              )}

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={() => void handleSaveNodeType()} disabled={nodeSaving}>
                  {nodeSaving ? 'Сохранение...' : 'Сохранить тип вершины'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="service-card">
          <div className="service-card-header">
            <div>
              <h3>Типы связей</h3>
              <p className="service-card-hint">
                Для одной и той же пары типов вершин можно описывать несколько разных типов связей.
              </p>
            </div>
            <div className="service-row">
              <button type="button" className="service-btn" onClick={handleResetEdgeTypeForm}>Новый тип</button>
            </div>
          </div>

          <div className="service-type-split">
            <div className="service-list">
              {edgeTypes.map((edgeType) => (
                <button
                  key={edgeType.id}
                  type="button"
                  className={`service-list-item ${selectedEdgeTypeId === edgeType.id ? 'active' : ''}`}
                  onClick={() => setSelectedEdgeTypeId(edgeType.id)}
                >
                  <strong>{edgeType.label}</strong>
                  <span>{edgeType.id}</span>
                  <span>{`${edgeType.allowed_from.length} -> ${edgeType.allowed_to.length}`}</span>
                </button>
              ))}
              {!edgeTypes.length && <div className="service-empty">Типы связей пока не заданы.</div>}
            </div>

            <div className="service-editor-block">
              <div className="service-editor-header">
                <div>
                  <h4>{selectedEdgeTypeId ? 'Редактирование типа связи' : 'Новый тип связи'}</h4>
                  <p>Связь знает свои допустимые типы вершин, визуал и то, как она попадает в контекстное меню.</p>
                </div>
                {selectedEdgeTypeId && (
                  <button type="button" className="service-btn danger" onClick={() => void handleDeleteEdgeType()} disabled={edgeSaving}>
                    Удалить
                  </button>
                )}
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>Ключ</span>
                  <input className="service-input" value={edgeTypeForm.id} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, id: event.target.value }))} placeholder="ip_msisdn_link" />
                </label>
                <label className="service-field">
                  <span>Название</span>
                  <input className="service-input" value={edgeTypeForm.label} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="IP <-> MSISDN" />
                </label>
                <label className="service-field">
                  <span>Цвет</span>
                  <div className="service-color-row">
                    <input className="service-color-input" type="color" value={edgeTypeForm.color} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, color: event.target.value }))} />
                    <input className="service-input" value={edgeTypeForm.color} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, color: event.target.value }))} />
                  </div>
                </label>
                <label className="service-field">
                  <span>Толщина</span>
                  <input className="service-input" value={edgeTypeForm.width} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, width: event.target.value }))} />
                </label>
                <label className="service-field">
                  <span>Направление</span>
                  <select className="service-input" value={edgeTypeForm.direction} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, direction: event.target.value }))}>
                    {edgeDirectionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={edgeTypeForm.directed} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, directed: event.target.checked }))} />
                  <span>Считать связь направленной</span>
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={edgeTypeForm.dashed} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, dashed: event.target.checked }))} />
                  <span>Пунктирная линия</span>
                </label>
              </div>

              <div className="service-editor-header">
                <div>
                  <h4>Допустимые типы вершин</h4>
                  <p>Укажи, между какими типами узлов можно создавать эту связь.</p>
                </div>
              </div>

              <div className="service-console-grid">
                <div className="service-card">
                  <h4>От каких типов</h4>
                  <div className="service-type-chip-grid">
                    {nodeTypeIds.map((nodeTypeId) => (
                      <label key={`from-${nodeTypeId}`} className={`service-type-chip ${edgeTypeForm.allowed_from.includes(nodeTypeId) ? 'active' : ''}`}>
                        <input type="checkbox" checked={edgeTypeForm.allowed_from.includes(nodeTypeId)} onChange={() => toggleAllowedType('from', nodeTypeId)} />
                        <span>{nodeTypeId}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="service-card">
                  <h4>К каким типам</h4>
                  <div className="service-type-chip-grid">
                    {nodeTypeIds.map((nodeTypeId) => (
                      <label key={`to-${nodeTypeId}`} className={`service-type-chip ${edgeTypeForm.allowed_to.includes(nodeTypeId) ? 'active' : ''}`}>
                        <input type="checkbox" checked={edgeTypeForm.allowed_to.includes(nodeTypeId)} onChange={() => toggleAllowedType('to', nodeTypeId)} />
                        <span>{nodeTypeId}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="service-editor-header">
                <div>
                  <h4>Плагин и меню</h4>
                  <p>Если этот тип связи строится через плагин, здесь можно задать, как именно он показывается пользователю.</p>
                </div>
              </div>

              <div className="service-form-grid">
                <label className="service-field">
                  <span>ID плагина</span>
                  <input className="service-input" value={edgeTypeForm.plugin_id} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, plugin_id: event.target.value }))} placeholder="project_ip_msisdn_links" />
                </label>
                <label className="service-field">
                  <span>Раздел меню</span>
                  <input className="service-input" value={edgeTypeForm.context_menu_section} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, context_menu_section: event.target.value }))} placeholder="Связи" />
                </label>
                <label className="service-field">
                  <span>Подпись в меню</span>
                  <input className="service-input" value={edgeTypeForm.context_menu_label} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, context_menu_label: event.target.value }))} placeholder="IP <-> MSISDN" />
                </label>
                <label className="service-field">
                  <span>Порядок</span>
                  <input className="service-input" value={edgeTypeForm.menu_order} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, menu_order: event.target.value }))} placeholder="10" />
                </label>
                <label className="service-checkbox">
                  <input type="checkbox" checked={edgeTypeForm.show_in_context_menu} onChange={(event) => setEdgeTypeForm((prev) => ({ ...prev, show_in_context_menu: event.target.checked }))} />
                  <span>Показывать в контекстном меню</span>
                </label>
              </div>

              <div className="service-preview-card">
                <span className="service-preview-label">Предпросмотр меню</span>
                <strong>{menuPreview}</strong>
              </div>

              <div className="service-editor-header">
                <div>
                  <h4>Атрибуты связи</h4>
                  <p>Например, время события, источник данных, вес или комментарий.</p>
                </div>
                <button type="button" className="service-btn" onClick={addEdgeAttribute}>Добавить атрибут</button>
              </div>

              {edgeTypeForm.attributes.length ? (
                <div className="service-editor-list">
                  {edgeTypeForm.attributes.map((attribute) => (
                    <div key={attribute.id} className="service-editor-card">
                      <div className="service-editor-card-header">
                        <strong>{attribute.label || attribute.key || 'Новый атрибут'}</strong>
                        <button type="button" className="service-btn danger" onClick={() => removeEdgeAttribute(attribute.id)}>Удалить</button>
                      </div>
                      <div className="service-column-grid">
                        <label className="service-field">
                          <span>Ключ</span>
                          <input className="service-input" value={attribute.key} onChange={(event) => updateEdgeAttribute(attribute.id, { key: event.target.value })} placeholder="event_time" />
                        </label>
                        <label className="service-field">
                          <span>Название</span>
                          <input className="service-input" value={attribute.label} onChange={(event) => updateEdgeAttribute(attribute.id, { label: event.target.value })} placeholder="Дата и время" />
                        </label>
                        <label className="service-field">
                          <span>Тип</span>
                          <select className="service-input" value={attribute.type} onChange={(event) => updateEdgeAttribute(attribute.id, { type: event.target.value })}>
                            {attributeTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="service-checkbox">
                          <input type="checkbox" checked={attribute.required} onChange={(event) => updateEdgeAttribute(attribute.id, { required: event.target.checked })} />
                          <span>Обязательный</span>
                        </label>
                        <label className="service-checkbox">
                          <input type="checkbox" checked={attribute.multiline} onChange={(event) => updateEdgeAttribute(attribute.id, { multiline: event.target.checked })} />
                          <span>Многострочное поле</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="service-empty">У этого типа связи пока нет описанных атрибутов.</div>
              )}

              <div className="service-row">
                <button type="button" className="service-btn primary" onClick={() => void handleSaveEdgeType()} disabled={edgeSaving}>
                  {edgeSaving ? 'Сохранение...' : 'Сохранить тип связи'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <datalist id="domain-node-icons">
        {defaultNodeIconOptions.map((icon) => (
          <option key={icon} value={icon} />
        ))}
      </datalist>
    </div>
  );
};

export default GraphDomainEditor;
