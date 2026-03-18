// frontend/src/components/layout/InspectorPanel.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface InspectorPanelProps {
  width: number;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ width }) => {
  const selectedElements = useSelector((state: RootState) => state.ui.selectedElements);
  const currentArtifactId = useSelector((state: RootState) => state.artifacts.currentArtifactId);
  const currentArtifact = currentArtifactId ? useSelector((state: RootState) => state.artifacts.items[currentArtifactId]) : null;

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
      person: '#97c2fc',
      phone: '#7be141',
      message: '#ffb752',
      location: '#ff7b7b',
      organization: '#d9b4ff',
      device: '#ffb3ba',
      email: '#b0e57c',
      social: '#f7cac9',
      document: '#c0c0c0',
      default: '#cccccc'
    };
    return colors[type] || colors.default;
  };

  const getCommonAttributes = () => {
    if (selectedElements.length < 2) return null;
    
    const allAttributes: Record<string, Set<any>> = {};
    const attributeValues: Record<string, Set<any>> = {};
    
    selectedElements.forEach(element => {
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
    
    const commonAttrs: Record<string, { values: Set<any>, isCommon: boolean }> = {};
    Object.keys(allAttributes).forEach(key => {
      if (allAttributes[key].size === selectedElements.length) {
        commonAttrs[key] = {
          values: attributeValues[key],
          isCommon: attributeValues[key].size === 1
        };
      }
    });
    
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
      
      {/* Компактный заголовок */}
      <div style={{
        padding: '12px 12px 8px 12px',
        borderBottom: '1px solid #374151'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#9ca3af',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.3px',
          marginBottom: '4px'
        }}>
          <span>⚡</span>
          <span>Инспектор</span>
          {selectedElements.length > 1 && (
            <span style={{
              backgroundColor: '#374151',
              padding: '2px 4px',
              borderRadius: '3px',
              fontSize: '9px',
              marginLeft: 'auto'
            }}>
              {selectedElements.length}
            </span>
          )}
        </div>
        {currentArtifact && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '4px'
          }}>
            <span style={{ fontSize: '16px' }}>{getTypeIcon(currentArtifact.type)}</span>
            <div style={{ flex: 1 }}>
              <div style={{
                color: '#ffffff',
                fontWeight: 500,
                fontSize: '12px',
                marginBottom: '2px'
              }}>
                {currentArtifact.name}
              </div>
              <div style={{
                color: '#6b7280',
                fontSize: '10px'
              }}>
                v{currentArtifact.version} • {formatDate(currentArtifact.updated_at)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Компактный контент */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px'
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
            gap: '8px',
            fontSize: '11px'
          }}>
            <span style={{ fontSize: '24px', opacity: 0.5 }}>👆</span>
            <div>
              Кликните на узел или связь
            </div>
          </div>
        ) : (
          <div>
            {/* Тип выделения */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #374151'
            }}>
              <span style={{ fontSize: '16px' }}>
                {selectedElements.length === 1 ? getTypeIcon(selectedElements[0].type) : '🔲'}
              </span>
              <span style={{
                color: '#9ca3af',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px'
              }}>
                {selectedElements.length === 1 
                  ? (selectedElements[0].type === 'node' ? 'Узел' : 'Связь')
                  : `${selectedElements.length} элементов`
                }
              </span>
            </div>

            {/* ID для одиночного выделения */}
            {selectedElements.length === 1 && (
              <div style={{
                backgroundColor: '#111827',
                borderRadius: '4px',
                padding: '8px',
                marginBottom: '12px'
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '9px',
                  textTransform: 'uppercase',
                  marginBottom: '2px'
                }}>
                  ID
                </div>
                <div style={{
                  color: '#3b82f6',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {selectedElements[0].id}
                </div>
              </div>
            )}

            {/* Общие атрибуты */}
            {selectedElements.length > 1 && commonAttributes && Object.keys(commonAttributes).length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>📋</span>
                  <span>Общие</span>
                </div>
                {Object.entries(commonAttributes).map(([key, { values, isCommon }]) => (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '9px',
                      textTransform: 'uppercase',
                      marginBottom: '2px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      color: '#ffffff',
                      fontSize: '11px',
                      wordBreak: 'break-word',
                      backgroundColor: '#111827',
                      padding: '6px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      border: isCommon ? '1px solid #3b82f6' : '1px solid #374151'
                    }}>
                      {isCommon ? formatValue(Array.from(values)[0]) : '(разные)'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Индивидуальные свойства */}
            {selectedElements.length === 1 && selectedElements[0].data && 
             Object.entries(selectedElements[0].data).map(([key, value]) => {
              if (key === 'id' || key === 'attributes') return null;
              
              if (key === 'color') {
                return (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '9px',
                      textTransform: 'uppercase',
                      marginBottom: '2px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        backgroundColor: String(value),
                        borderRadius: '4px',
                        border: '1px solid #374151'
                      }} />
                      <span style={{ color: '#ffffff', fontSize: '11px' }}>{String(value)}</span>
                    </div>
                  </div>
                );
              }

              if (key === 'type' && selectedElements[0].type === 'node') {
                return (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '9px',
                      textTransform: 'uppercase',
                      marginBottom: '2px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: getNodeTypeColor(String(value)),
                        borderRadius: '3px'
                      }} />
                      <span style={{ color: '#ffffff', fontSize: '11px' }}>{String(value)}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={key} style={{ marginBottom: '8px' }}>
                  <div style={{
                    color: '#9ca3af',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    marginBottom: '2px'
                  }}>
                    {key}
                  </div>
                  <div style={{
                    color: '#ffffff',
                    fontSize: '11px',
                    wordBreak: 'break-word',
                    backgroundColor: '#111827',
                    padding: '6px',
                    borderRadius: '4px'
                  }}>
                    {formatValue(value)}
                  </div>
                </div>
              );
            })}

            {/* Атрибуты */}
            {selectedElements.length === 1 && 
             selectedElements[0].data?.attributes && 
             Object.keys(selectedElements[0].data.attributes).length > 0 && (
              <div style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid #374151'
              }}>
                <div style={{
                  color: '#9ca3af',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>📦</span>
                  <span>Атрибуты</span>
                </div>
                {Object.entries(selectedElements[0].data.attributes).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <div style={{
                      color: '#9ca3af',
                      fontSize: '9px',
                      textTransform: 'uppercase',
                      marginBottom: '2px'
                    }}>
                      {key}
                    </div>
                    <div style={{
                      color: '#ffffff',
                      fontSize: '11px',
                      wordBreak: 'break-word',
                      backgroundColor: '#111827',
                      padding: '6px',
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