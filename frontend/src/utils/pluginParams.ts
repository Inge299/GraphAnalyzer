// frontend/src/utils/pluginParams.ts
import type { ApiPlugin, PluginParamSpec } from '../types/api';

const STORAGE_PREFIX = 'ga:project-plugin-defaults:';

const START_KEYS = ['period_start', 'start_date', 'date_from', 'from_date'];
const END_KEYS = ['period_end', 'end_date', 'date_to', 'to_date'];

type ParamInput = {
  spec: PluginParamSpec;
  input: HTMLInputElement | HTMLSelectElement;
};

export type ProjectPluginDefaults = {
  period_start?: string;
  period_end?: string;
};

const toStringSafe = (value: any) => (value === undefined || value === null ? '' : String(value));

const parseStored = (projectId: number): ProjectPluginDefaults => {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const saveStored = (projectId: number, next: ProjectPluginDefaults) => {
  localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(next));
};

const isStartKey = (key: string) => START_KEYS.includes(key.toLowerCase());
const isEndKey = (key: string) => END_KEYS.includes(key.toLowerCase());

const getParamKey = (spec: PluginParamSpec) => String(spec.key || spec.name || '').trim();

const getDefaultForParam = (spec: PluginParamSpec, defaults: ProjectPluginDefaults) => {
  const key = getParamKey(spec).toLowerCase();
  if (spec.default !== undefined && spec.default !== null && String(spec.default).trim() !== '') {
    return spec.default;
  }

  if (spec.type === 'date') {
    if (isStartKey(key) && defaults.period_start) return defaults.period_start;
    if (isEndKey(key) && defaults.period_end) return defaults.period_end;
  }

  return '';
};

const parseValueByType = (type: PluginParamSpec['type'], raw: string): any => {
  if (type === 'string' || type === 'date') return raw;

  if (type === 'integer') {
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  if (type === 'number') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  if (type === 'boolean') {
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'да'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'нет'].includes(normalized)) return false;
    return null;
  }

  return raw;
};

const createInputForSpec = (spec: PluginParamSpec, defaultValue: string) => {
  if (spec.type === 'boolean') {
    const select = document.createElement('select');
    select.style.padding = '6px 8px';
    select.style.border = '1px solid #cbd5e1';
    select.style.borderRadius = '8px';
    select.style.fontSize = '13px';
    select.style.background = '#ffffff';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = spec.required ? 'Выберите значение' : 'Не задано';
    select.appendChild(empty);

    const yes = document.createElement('option');
    yes.value = 'true';
    yes.textContent = 'Да';
    select.appendChild(yes);

    const no = document.createElement('option');
    no.value = 'false';
    no.textContent = 'Нет';
    select.appendChild(no);

    const normalized = defaultValue.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'да'].includes(normalized)) {
      select.value = 'true';
    } else if (['0', 'false', 'no', 'n', 'нет'].includes(normalized)) {
      select.value = 'false';
    }

    return select;
  }

  const input = document.createElement('input');
  input.style.padding = '6px 8px';
  input.style.border = '1px solid #cbd5e1';
  input.style.borderRadius = '8px';
  input.style.fontSize = '13px';
  input.style.background = '#ffffff';
  input.value = defaultValue;

  if (spec.type === 'date') {
    input.type = 'date';
  } else if (spec.type === 'integer' || spec.type === 'number') {
    input.type = 'number';
    input.step = spec.type === 'integer' ? '1' : 'any';
  } else {
    input.type = 'text';
  }

  return input;
};

const formatDateISO = (date: Date) => date.toISOString().slice(0, 10);

const openPluginParamsDialog = (
  plugin: ApiPlugin,
  schema: PluginParamSpec[],
  defaults: ProjectPluginDefaults,
): Promise<Record<string, any> | null> => {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.45)';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const modal = document.createElement('div');
    modal.style.width = 'min(560px, calc(100vw - 24px))';
    modal.style.maxHeight = '82vh';
    modal.style.overflow = 'auto';
    modal.style.background = '#f8fafc';
    modal.style.border = '1px solid #d7deea';
    modal.style.borderRadius = '12px';
    modal.style.boxShadow = '0 14px 40px rgba(15, 23, 42, 0.28)';
    modal.style.padding = '12px';

    const title = document.createElement('div');
    title.textContent = `Параметры плагина: ${plugin.name}`;
    title.style.fontWeight = '600';
    title.style.fontSize = '15px';
    title.style.color = '#0f172a';
    title.style.marginBottom = '4px';
    modal.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Заполните поля и нажмите «Запустить»';
    subtitle.style.fontSize = '12px';
    subtitle.style.color = '#64748b';
    subtitle.style.marginBottom = '10px';
    modal.appendChild(subtitle);

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '8px';

    const error = document.createElement('div');
    error.style.display = 'none';
    error.style.padding = '7px 9px';
    error.style.borderRadius = '8px';
    error.style.background = '#fee2e2';
    error.style.color = '#991b1b';
    error.style.fontSize = '12px';

    const controls: ParamInput[] = schema.map((spec) => {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'minmax(130px, 170px) 1fr';
      row.style.alignItems = 'center';
      row.style.gap = '8px';

      const label = document.createElement('label');
      label.textContent = spec.label || getParamKey(spec);
      label.style.fontSize = '13px';
      label.style.color = '#334155';

      const defaultValue = toStringSafe(getDefaultForParam(spec, defaults));
      const input = createInputForSpec(spec, defaultValue);

      row.appendChild(label);
      row.appendChild(input);
      form.appendChild(row);

      return { spec, input };
    });

    const dateStart = controls.find((item) => item.spec.type === 'date' && isStartKey(getParamKey(item.spec)));
    const dateEnd = controls.find((item) => item.spec.type === 'date' && isEndKey(getParamKey(item.spec)));

    if (dateStart && dateEnd) {
      const presetRow = document.createElement('div');
      presetRow.style.display = 'flex';
      presetRow.style.gap = '6px';
      presetRow.style.flexWrap = 'wrap';
      presetRow.style.margin = '2px 0 2px 0';

      const applyPreset = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - Math.max(days - 1, 0));
        (dateStart.input as HTMLInputElement).value = formatDateISO(start);
        (dateEnd.input as HTMLInputElement).value = formatDateISO(end);
      };

      const presets: Array<{ label: string; days: number }> = [
        { label: 'Сегодня', days: 1 },
        { label: '7 дней', days: 7 },
        { label: '30 дней', days: 30 },
        { label: '90 дней', days: 90 },
      ];

      presets.forEach((preset) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = preset.label;
        button.style.padding = '5px 8px';
        button.style.borderRadius = '7px';
        button.style.border = '1px solid #cbd5e1';
        button.style.background = '#ffffff';
        button.style.fontSize = '12px';
        button.style.cursor = 'pointer';
        button.addEventListener('click', () => applyPreset(preset.days));
        presetRow.appendChild(button);
      });

      form.appendChild(presetRow);
    }

    form.appendChild(error);

    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.justifyContent = 'flex-end';
    buttons.style.gap = '8px';
    buttons.style.marginTop = '4px';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Отмена';
    cancelButton.style.padding = '7px 11px';
    cancelButton.style.borderRadius = '8px';
    cancelButton.style.border = '1px solid #cbd5e1';
    cancelButton.style.background = '#ffffff';
    cancelButton.style.color = '#334155';
    cancelButton.style.cursor = 'pointer';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Запустить';
    submitButton.style.padding = '7px 11px';
    submitButton.style.borderRadius = '8px';
    submitButton.style.border = '1px solid #2563eb';
    submitButton.style.background = '#2563eb';
    submitButton.style.color = '#ffffff';
    submitButton.style.cursor = 'pointer';

    buttons.appendChild(cancelButton);
    buttons.appendChild(submitButton);
    form.appendChild(buttons);

    modal.appendChild(form);
    overlay.appendChild(modal);

    const close = (result: Record<string, any> | null) => {
      window.removeEventListener('keydown', onKeyDown);
      overlay.remove();
      resolve(result);
    };

    const showError = (message: string) => {
      error.textContent = message;
      error.style.display = 'block';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    cancelButton.addEventListener('click', () => close(null));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      error.style.display = 'none';

      const result: Record<string, any> = {};

      for (const control of controls) {
        const { spec, input } = control;
        const key = getParamKey(spec);
        const label = spec.label || key;
        const raw = toStringSafe(input.value).trim();

        if (!raw) {
          if (spec.required) {
            showError(`Параметр "${label}" обязателен.`);
            input.focus();
            return;
          }
          continue;
        }

        const parsed = parseValueByType(spec.type, raw);
        if ((spec.type === 'number' || spec.type === 'integer') && !Number.isFinite(parsed)) {
          showError(`Для параметра "${label}" нужно корректное число.`);
          input.focus();
          return;
        }

        if (spec.type === 'boolean' && parsed === null) {
          showError(`Для параметра "${label}" выберите Да или Нет.`);
          input.focus();
          return;
        }

        if (!key) {
          showError('Некорректный параметр плагина: отсутствует key/name.');
          input.focus();
          return;
        }

        result[key] = parsed;
      }

      close(result);
    });

    document.body.appendChild(overlay);
    if (controls.length > 0) controls[0].input.focus();
  });
};

export const collectPluginParamsWithPrompts = async (
  plugin: ApiPlugin,
  projectId: number,
): Promise<Record<string, any> | null> => {
  const schema = plugin.params_schema || [];
  if (schema.length === 0) return {};

  const defaults = parseStored(projectId);
  const result = await openPluginParamsDialog(plugin, schema, defaults);
  if (result === null) return null;

  rememberProjectPeriodDefaults(projectId, result);
  return result;
};

export const rememberProjectPeriodDefaults = (projectId: number, params: Record<string, any>) => {
  if (!params || typeof params !== 'object') return;

  const defaults = parseStored(projectId);
  let changed = false;

  Object.entries(params).forEach(([rawKey, value]) => {
    const key = rawKey.toLowerCase();
    const asString = toStringSafe(value).trim();
    if (!asString) return;

    if (isStartKey(key)) {
      defaults.period_start = asString;
      changed = true;
    } else if (isEndKey(key)) {
      defaults.period_end = asString;
      changed = true;
    }
  });

  if (changed) saveStored(projectId, defaults);
};

export const groupPluginsByMenuPath = (plugins: ApiPlugin[]) => {
  const groups = new Map<string, ApiPlugin[]>();

  plugins.forEach((plugin) => {
    const path = (plugin.menu_path || 'Прочее').trim() || 'Прочее';
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path)!.push(plugin);
  });

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([path, list]) => ({
      path,
      items: [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    }));
};

