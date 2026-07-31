import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { domainModelApi } from '../../../services/api';
import type { ReferenceProvider } from '../../../types/api';

interface ReferenceProvidersSectionProps {
  onMessage: (message: string | null) => void;
  onError: (message: string | null) => void;
}

const ReferenceProvidersSection: React.FC<ReferenceProvidersSectionProps> = ({ onMessage, onError }) => {
  const [providers, setProviders] = useState<ReferenceProvider[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => providers.find((provider) => provider.id === selectedId) || providers[0] || null,
    [providers, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await domainModelApi.listReferenceProviders();
      setProviders(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : (next[0]?.id ?? null));
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || 'Не удалось получить список провайдеров'));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => { void load(); }, [load]);

  const updateSelected = (updates: Partial<ReferenceProvider>) => {
    if (!selected) return;
    setProviders((current) => current.map((provider) => provider.id === selected.id ? { ...provider, ...updates } : provider));
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const saved = await domainModelApi.saveReferenceProvider(selected.id, {
        name: selected.name,
        description: selected.description,
        enabled: selected.enabled,
        config: { table: selected.config?.table || '' },
      });
      setProviders((current) => current.map((provider) => provider.id === saved.id ? saved : provider));
      onMessage('Настройки провайдера сохранены');
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || 'Не удалось сохранить провайдера'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="service-import-admin">
      <h3>Провайдеры данных</h3>
      <p className="service-card-hint">Провайдеры подключают внешние справочники к плагинам анализа. Метаданные можно переносить пакетом, а секреты подключения остаются в переменных окружения сервера.</p>
      <div className="service-split-grid">
        <div className="service-card">
          <div className="service-row"><button type="button" className="service-btn" onClick={() => void load()} disabled={loading}>{loading ? 'Обновление...' : 'Обновить'}</button></div>
          <div className="service-list">
            {providers.map((provider) => (
              <button key={provider.id} type="button" className={`service-list-item ${selected?.id === provider.id ? 'active' : ''}`} onClick={() => setSelectedId(provider.id)}>
                <strong>{provider.name}</strong><span>{provider.kind} · {provider.enabled ? 'активен' : 'отключен'}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="service-card">
          {selected ? <>
            <h4>{selected.name}</h4>
            <label className="service-field"><span>Идентификатор</span><input value={selected.id} disabled /></label>
            <label className="service-field"><span>Название</span><input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} /></label>
            <label className="service-field"><span>Описание</span><textarea value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} /></label>
            {selected.editable_fields?.includes('config.table') ? <label className="service-field"><span>Таблица справочника</span><input value={selected.config?.table || ''} onChange={(event) => updateSelected({ config: { ...selected.config, table: event.target.value } })} /></label> : null}
            <label className="service-checkbox"><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected({ enabled: event.target.checked })} /> Провайдер активен</label>
            <p className="service-card-hint">Строка подключения читается из <code>{selected.config?.dsn_env || 'переменной окружения'}</code> и намеренно не отображается здесь.</p>
            <div className="service-row"><button type="button" className="service-btn primary" onClick={() => void save()} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить провайдера'}</button></div>
          </> : <p className="service-card-hint">Нет зарегистрированных провайдеров.</p>}
        </div>
      </div>
    </div>
  );
};

export default ReferenceProvidersSection;
