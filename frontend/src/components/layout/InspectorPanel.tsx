// frontend/src/components/layout/InspectorPanel.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState, SelectedElement } from '../../store/slices/uiSlice';

interface InspectorPanelProps {
  width: number;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ width }) => {
  const selectedElements = useSelector((state: RootState) => state.ui.selectedElements);
  const currentArtifact = useSelector((state: RootState) => state.artifacts.currentArtifact);

  console.log('[InspectorPanel] Selected elements:', selectedElements);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      node: '🔘',
      edge: '🔗',
      graph: '📊',
      table: '📋',
      map: '🗺️',
      chart: '📈',
      document: '📄'
    };
    return icons[type] || '📁';
  };

  const getNodeTypeColor = (type: string) => {
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

  // Функция для получения общих атрибутов
  const getCommonAttributes = () => {
    if (selectedElements.length < 2) return null;
    
    console.log('[InspectorPanel] Computing common attributes for', selectedElements.length, 'elements');
    
    // Собираем все атрибуты из всех выделенных элементов
    const allAttributes: Record<string, Set<any>> = {};
    const attributeValues: Record<string, Set<any>> = {};
    
    selectedElements.forEach(element => {
      console.log('[InspectorPanel] Element data:', element.data);
      
      // Проверяем attributes в данных
      const attributes = element.data?.attributes || {};
      
      Object.entries(attributes).forEach(([key, value]) => {
        if (!allAttributes[key]) {
          allAttributes[key] = new Set();
          attributeValues[key] = new Set();
        }
        allAttributes[key].add(key);
        attributeValues[key].add(value);
      });
    });
    
    console.log('[InspectorPanel] All attributes:', allAttributes);
    console.log('[InspectorPanel] Attribute values:', attributeValues);
    
    // Возвращаем только те атрибуты, которые есть у всех элементов
    const commonAttrs: Record<string, { values: Set<any>, isCommon: boolean }> = {};
    Object.keys(allAttributes).forEach(key => {
      if (allAttributes[key].size === selectedElements.length) {
        commonAttrs[key] = {
          values: attributeValues[key],
          isCommon: attributeValues[key].size === 1
        };
      }
    });
    
    console.log('[InspectorPanel] Common attributes:', commonAttrs);
    return commonAttrs;
  };

  const commonAttributes = getCommonAttributes();

  return (
    <div style={{
      width,
      height: '100%',
      backgroundColor: '#1f2937',
      borderLeft: '1px solid #374151',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      
      <div style={{
        padding: '20px 20px 12px 20px',
        borderBottom: '1px solid #374151'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#9ca3af',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '4px'
        }}>
          <span>⚡</span>
          <span>Инспектор</span>
          {selectedElements.length > 1 && (
            <span style={{
              backgroundColor: '#374151',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              marginLeft: 'auto'
            }}>
              {selectedElements.length} элементов
            </span>
          )}
        </div>
        {currentArtifact && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>{getTypeIcon(currentArtifact.type)}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                color: '#ffffff',
                fontWeight: 500,
                fontSize: '14px',
                marginBottom: '2px'
              }}>
                {currentArtifact.name}
              </div>
              <div style={{
                color: '#6b7280',
                fontSize: '11px'
              }}>
                v{currentArtifact.version} • {formatDate(currentArtifact.updated_at)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        {selectedElements.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#6b7280',
            textAlign: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '32px', opacity: 0.5 }}>👆</span>
            <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
              Кликните на узел или связь,<br />чтобы увидеть свойства
            </div>
          </div>
        ) : (
          <div>
            {/* Информация о выделении */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid #374151'
            }}>
              <span style={{ fontSize: '20px' }}>
                {selectedElements.length === 1 ? getTypeIcon(selectedElements[0].type) : '🔲'}
              </span>
              <span style={{
                color: '#9ca3af',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {selectedElements.length === 1 
                  ? (selectedElements[0].type === 'node' ? 'Узел' : 'Связь')
                  : `Выделено ${selectedElements.length} элементов`
                }
              </span>
            </div>

            {/* ID для одиночного выделения */}
            {selectedElements.length === 1 && (
              <div style={{
                backgroundColor: '#111827',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '4px'
                }}>
                  ID
                </div>
                <div style={{
                  color: '#3b82f6',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {selectedElements[0].id}
                </div>
              </div>
            )}

            {/* Общие атрибуты для множественного выделения */}
            {selectedElements.length > 1 && commonAttributes && Object.keys(commonAttributes).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>📋</span>
                  <span>Общие атрибуты</span>
                </div>
                {Object.entries(commonAttributes).map(([key, { values, isCommon }]) => (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      color: '#ffffff',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      backgroundColor: '#111827',
                      padding: '8px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      border: isCommon ? '1px solid #3b82f6' : '1px solid #374151'
                    }}>
                      {isCommon ? formatValue(Array.from(values)[0]) : '(разные значения)'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Если есть выделенные элементы, но нет общих атрибутов */}
            {selectedElements.length > 1 && (!commonAttributes || Object.keys(commonAttributes).length === 0) && (
              <div style={{
                backgroundColor: '#111827',
                borderRadius: '8px',
                padding: '16px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                Нет общих атрибутов
              </div>
            )}

            {/* Индивидуальные свойства для одиночного выделения */}
            {selectedElements.length === 1 && selectedElements[0].data && 
             Object.entries(selectedElements[0].data).map(([key, value]) => {
              if (key === 'id' || key === 'attributes') return null;
              
              if (key === 'color') {
                return (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: String(value),
                        borderRadius: '6px',
                        border: '1px solid #374151'
                      }} />
                      <span style={{ color: '#ffffff', fontSize: '12px' }}>{String(value)}</span>
                    </div>
                  </div>
                );
              }

              if (key === 'type' && selectedElements[0].type === 'node') {
                return (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: getNodeTypeColor(String(value)),
                        borderRadius: '4px'
                      }} />
                      <span style={{ color: '#ffffff', fontSize: '12px' }}>{String(value)}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} style={{ marginBottom: '12px' }}>
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px'
                  }}>
                    {key}
                  </div>
                  <div style={{
                    color: '#ffffff',
                    fontSize: '12px',
                    wordBreak: 'break-word',
                    backgroundColor: value !== null && typeof value === 'object' ? '#111827' : 'transparent',
                    padding: value !== null && typeof value === 'object' ? '8px' : '0',
                    borderRadius: '4px',
                    fontFamily: value !== null && typeof value === 'object' ? 'monospace' : 'inherit'
                  }}>
                    {formatValue(value)}
                  </div>
                </div>
              );
            })}

            {/* Атрибуты для одиночного выделения */}
            {selectedElements.length === 1 && 
             selectedElements[0].data?.attributes && 
             Object.keys(selectedElements[0].data.attributes).length > 0 && (
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #374151'
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>📦</span>
                  <span>Атрибуты</span>
                </div>
                {Object.entries(selectedElements[0].data.attributes).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '12px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      color: '#ffffff',
                      fontSize: '12px',
                      wordBreak: 'break-word',
                      backgroundColor: '#111827',
                      padding: '8px',
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {formatValue(value)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InspectorPanel;