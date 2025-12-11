import { FC, MouseEvent, useState } from 'react';

import type { LayerSection } from '../types';

interface SidebarProps {
  activeLayers?: string[];
  onLayerToggle: (layerId: string) => void;
}

const Sidebar: FC<SidebarProps> = ({ activeLayers = [], onLayerToggle }) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);

  const sections: LayerSection[] = [
    {
      id: 'base',
      title: 'BASE MAP',
      layers: [{ id: 'satellite', name: 'Satellite' }],
    },
    {
      id: 'weather',
      title: 'WEATHER MAPS',
      layers: [
        { id: 'radar', name: 'Radar' },
        { id: 'precipitation', name: 'Precipitation' },
        { id: 'wind', name: 'Wind' },
        { id: 'temperature', name: 'Temperature' },
        { id: 'humidity', name: 'Humidity' },
        { id: 'pressure', name: 'Pressure' },
      ],
    },
    {
      id: 'ocean',
      title: 'OCEAN ANALYSIS',
      layers: [
        { id: 'waves', name: 'Ocean Waves' },
        { id: 'cyclones', name: 'Cyclones' },
        { id: 'vessels', name: 'Vessels' },
        { id: 'aqi', name: 'Air Quality' },
      ],
    },
  ];

  // Collapsed button
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: '46px',
          height: '46px',
          borderRadius: '12px',
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: '22px',
          cursor: 'pointer',
        }}
      >
        ☰
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '250px',
        maxHeight: '78vh',
        background: 'rgba(0,0,0,0.70)',
        backdropFilter: 'blur(14px)',
        borderRadius: '14px',
        color: 'white',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 18px',
          fontWeight: 700,
          fontSize: '15px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        WEATHER MAPS
        <button
          onClick={() => setCollapsed(true)}
          style={{
            background: 'none',
            border: 0,
            color: 'rgba(255,255,255,0.65)',
            fontSize: '21px',
            cursor: 'pointer',
            marginTop: '-3px',
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div
        style={{
          maxHeight: 'calc(78vh - 55px)',
          overflowY: 'auto',
          paddingRight: '6px',

          /* Hide scrollbar */
          scrollbarWidth: 'none',
        }}
      >
        {/* Hide scrollbar (Chrome) */}
        <style>
          {`
            div::-webkit-scrollbar {
              width: 0;
            }
          `}
        </style>

        {sections.map((section: LayerSection) => (
          <div
            key={section.id}
            style={{ paddingBottom: '6px' }}
          >
            <div
              style={{
                padding: '14px 18px 6px',
                fontSize: '11px',
                fontWeight: 600,
                opacity: 0.55,
                letterSpacing: '0.8px',
              }}
            >
              {section.title}
            </div>

            {section.layers.map((layer) => {
              const isActive = activeLayers.includes(layer.id);

              return (
                <button
                  key={layer.id}
                  onClick={() => onLayerToggle(layer.id)}
                  style={{
                    width: '100%',
                    padding: '11px 18px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: 500,
                    background: isActive
                      ? 'rgba(66,133,244,0.25)'
                      : 'transparent',
                    border: 'none',
                    borderLeft: isActive
                      ? '4px solid #4285F4'
                      : '4px solid transparent',
                    color: 'white',
                    cursor: 'pointer',
                    transition: '0.2s',
                  }}
                  onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        'transparent';
                    }
                  }}
                >
                  {layer.name}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
