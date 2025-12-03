import React, { FC } from 'react';

interface TimelineProps {
  onTimeChange?: (time: Date) => void;
}

const Timeline: FC<TimelineProps> = ({ onTimeChange: _onTimeChange }) => {
  return <div>{/* Timeline implementation coming soon */}</div>;
};

export default Timeline;
