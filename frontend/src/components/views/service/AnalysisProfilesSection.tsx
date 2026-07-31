import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { domainModelApi, pluginApi } from '../../../services/api';
import type { AnalysisPluginPreset, DomainEdgeType } from '../../../types/api';

interface AnalysisProfilesSectionProps {
  onMessage: (message: string | null) => void;
  onError: (error: string | null) => void;
}

type ProfileForm = {
  id: string;
  name: string;
  description: string;
  menu_path: string;
  menu_order: string;
  relation_type: string;
};

const emptyForm = (): ProfileForm => ({
  id: '',
  name: '',
  description: '',
  menu_path: '\u0410\u043d\u0430\u043b\u0438\u0437',
  menu_order: '0',
  relation_type: '',
});

const formFromPreset = (preset: AnalysisPluginPreset): ProfileForm => ({
  id: preset.id,
  name: preset.name,
  description: preset.description,
  menu_path: preset.menu_path,
  menu_order: String(preset.menu_order),
  relation_type: preset.fixed_params.relation_type,
});

const createProfileId = (relationType: string): string => {
  const suffix = relationType.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `relations_${suffix || 'profile'}`.slice(0, 81);
};

const AnalysisProfilesSection: React.FC<AnalysisProfilesSectionProps> = ({ onMessage, onError }) => {
  const [profiles, setProfiles] = useState<AnalysisPluginPreset[]>([]);
  const [edgeTypes, setEdgeTypes] = useState<DomainEdgeType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? null,
    [profiles, selectedId],
  );

  const edgeTypeById = useMemo(
    () => new Map(edgeTypes.map((edgeType) => [edgeType.id, edgeType])),
    [edgeTypes],
  );

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [presetsResult, edgesResult] = await Promise.all([
        pluginApi.listAnalysisPresets(),
        domainModelApi.listEdgeTypes(),
      ]);
      const nextProfiles = presetsResult.presets.sort((left, right) => (
        left.menu_path.localeCompare(right.menu_path) || left.menu_order - right.menu_order || left.name.localeCompare(right.name)
      ));
      setProfiles(nextProfiles);
      setEdgeTypes(edgesResult);
      setSelectedId((current) => current && nextProfiles.some((profile) => profile.id === current) ? current : nextProfiles[0]?.id ?? null);
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u0438 \u0430\u043d\u0430\u043b\u0438\u0437\u0430'));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (selectedProfile) setForm(formFromPreset(selectedProfile));
  }, [selectedProfile]);

  const selectProfile = (profile: AnalysisPluginPreset) => {
    setSelectedId(profile.id);
    setForm(formFromPreset(profile));
    onMessage(null);
    onError(null);
  };

  const startNew = () => {
    const firstRelation = edgeTypes[0]?.id ?? '';
    setSelectedId(null);
    setForm({ ...emptyForm(), relation_type: firstRelation, id: createProfileId(firstRelation) });
    onMessage(null);
    onError(null);
  };

  const save = async () => {
    onMessage(null);
    onError(null);
    setSaving(true);
    try {
      const payload: AnalysisPluginPreset = {
        id: form.id.trim(),
        base_plugin_id: 'expand_typed_relations',
        name: form.name.trim(),
        description: form.description.trim(),
        menu_path: form.menu_path.trim(),
        menu_order: Number.parseInt(form.menu_order, 10) || 0,
        fixed_params: { relation_type: form.relation_type },
      };
      const response = await pluginApi.saveAnalysisPreset(payload);
      await load();
      setSelectedId(response.preset.id);
      setForm(formFromPreset(response.preset));
      onMessage(`\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u00ab${response.preset.name}\u00bb \u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d.`);
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedProfile || !window.confirm(`\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c \u00ab${selectedProfile.name}\u00bb?`)) return;
    onMessage(null);
    onError(null);
    setSaving(true);
    try {
      await pluginApi.deleteAnalysisPreset(selectedProfile.id);
      setSelectedId(null);
      setForm(emptyForm());
      await load();
      onMessage(`\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u00ab${selectedProfile.name}\u00bb \u0443\u0434\u0430\u043b\u0451\u043d.`);
    } catch (error: any) {
      onError(String(error?.response?.data?.detail || error?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="service-import-admin">
      <div className="service-card-header">
        <div>
          <h3>{'\u041f\u0440\u043e\u0444\u0438\u043b\u0438 \u0430\u043d\u0430\u043b\u0438\u0437\u0430'}</h3>
          <p className="service-card-hint">{'\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u0435\u0442 \u0432 \u043c\u0435\u043d\u044e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0440\u0430\u0441\u043a\u0440\u044b\u0442\u0438\u044f \u043e\u0434\u043d\u043e\u0433\u043e \u0442\u0438\u043f\u0430 \u0441\u0432\u044f\u0437\u0438. \u041e\u0434\u0438\u043d \u0440\u0430\u0437\u0434\u0435\u043b \u043c\u0435\u043d\u044e \u043c\u043e\u0436\u0435\u0442 \u043e\u0431\u044a\u0435\u0434\u0438\u043d\u044f\u0442\u044c \u043b\u044e\u0431\u043e\u0435 \u0447\u0438\u0441\u043b\u043e \u043f\u0440\u043e\u0444\u0438\u043b\u0435\u0439.'}</p>
        </div>
        <div className="service-row">
          <button type="button" className="service-btn" onClick={() => void load()} disabled={loading || saving}>{'\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c'}</button>
          <button type="button" className="service-btn primary" onClick={startNew} disabled={saving}>{'\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c'}</button>
        </div>
      </div>

      <div className="service-import-plugin-editor">
        <div className="service-list">
          {profiles.map((profile) => {
            const edge = edgeTypeById.get(profile.fixed_params.relation_type);
            return <button key={profile.id} type="button" className={`service-list-item ${profile.id === selectedId ? 'active' : ''}`} onClick={() => selectProfile(profile)}>
              <strong>{profile.name}</strong>
              <span>{profile.menu_path} · {edge?.label || profile.fixed_params.relation_type}</span>
              <span>{profile.id}</span>
            </button>;
          })}
          {!loading && profiles.length === 0 && <div className="service-empty">{'\u041f\u0440\u043e\u0444\u0438\u043b\u0435\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.'}</div>}
        </div>

        <div className="service-card service-card-compact">
          <div className="service-summary-header"><h4>{selectedProfile ? '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0444\u0438\u043b\u044f' : '\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u0444\u0438\u043b\u044c'}</h4></div>
          <div className="service-form-grid">
            <label className="service-field"><span>ID</span><input className="service-input" value={form.id} disabled={Boolean(selectedProfile)} onChange={(event) => setForm((value) => ({ ...value, id: event.target.value }))} /></label>
            <label className="service-field"><span>{'\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435'}</span><input className="service-input" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label>
            <label className="service-field"><span>{'\u0420\u0430\u0437\u0434\u0435\u043b \u043c\u0435\u043d\u044e'}</span><input className="service-input" list="analysis-profile-groups" value={form.menu_path} onChange={(event) => setForm((value) => ({ ...value, menu_path: event.target.value }))} /></label>
            <label className="service-field"><span>{'\u041f\u043e\u0440\u044f\u0434\u043e\u043a'}</span><input className="service-input" type="number" value={form.menu_order} onChange={(event) => setForm((value) => ({ ...value, menu_order: event.target.value }))} /></label>
            <label className="service-field service-field-wide"><span>{'\u0422\u0438\u043f \u0441\u0432\u044f\u0437\u0438'}</span><select className="service-input" value={form.relation_type} onChange={(event) => setForm((value) => ({ ...value, relation_type: event.target.value, id: selectedProfile ? value.id : createProfileId(event.target.value) }))}><option value="">{'\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0438\u043f \u0441\u0432\u044f\u0437\u0438'}</option>{edgeTypes.map((edge) => <option key={edge.id} value={edge.id}>{edge.label} ({edge.from_type} → {edge.to_type})</option>)}</select></label>
            <label className="service-field service-field-wide"><span>{'\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435'}</span><textarea className="service-textarea service-textarea-small" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
          </div>
          <datalist id="analysis-profile-groups">{Array.from(new Set(profiles.map((profile) => profile.menu_path))).map((group) => <option key={group} value={group} />)}</datalist>
          <div className="service-row"><button type="button" className="service-btn primary" onClick={() => void save()} disabled={saving || loading}>{saving ? '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...' : '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u0444\u0438\u043b\u044c'}</button>{selectedProfile && <button type="button" className="service-btn danger" onClick={() => void remove()} disabled={saving}>{'\u0423\u0434\u0430\u043b\u0438\u0442\u044c'}</button>}</div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisProfilesSection;