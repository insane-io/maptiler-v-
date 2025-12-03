import React, { FC } from 'react';

import type { GeoJSONProperties, MapPosition } from '../types';

interface InfoPanelProps {
  data?: GeoJSONProperties | null;
  position?: MapPosition | null;
}

const InfoPanel: FC<InfoPanelProps> = ({
  data: _data,
  position: _position,
}) => {
  return <div>{/* InfoPanel implementation coming soon */}</div>;
};

export default InfoPanel;
