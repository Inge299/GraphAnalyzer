// frontend/src/utils/formatters.ts

export const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

export const formatDate = (date: string) => {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getTypeIcon = (type: string) => {
  const icons: Record<string, string> = {
    node: '🔘',
    edge: '🔗',
    graph: '📊',
    table: '📋',
    map: '🗺️',
    chart: '📈',
    document: '📄',
    person: '👤',
    phone: '📞',
    location: '📍',
    message: '💬',
    organization: '🏢',
    email: '📧',
    social: '👥',
    default: '📁'
  };
  return icons[type] || icons.default;
};

export const getNodeTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    person: '#3B82F6',
    phone: '#10B981',
    location: '#EF4444',
    message: '#F59E0B',
    organization: '#8B5CF6',
    email: '#EC4899',
    social: '#06B6D4',
    document: '#6B7280'
  };
  return colors[type] || '#6B7280';
};