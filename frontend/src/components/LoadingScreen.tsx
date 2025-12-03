import '../styles/LoadingScreen.css';

import React, { useEffect, useState } from 'react';

const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return prev;
        } // Cap at 90% until actual load completes
        return prev + Math.random() * 10;
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-overlay">
      <div className="loading-container">
        <div className="surfing-wave">
          <div
            className="wave"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="wave"
            style={{ animationDelay: '0.15s' }}
          />
          <div
            className="wave"
            style={{ animationDelay: '0.3s' }}
          />
          <div
            className="wave"
            style={{ animationDelay: '0.45s' }}
          />
          <div
            className="wave"
            style={{ animationDelay: '0.6s' }}
          />
        </div>

        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">{Math.round(progress)}%</div>
        </div>

        <h2 className="loading-text">Loading Map</h2>
        <p className="loading-subtext">
          Initializing layers and fetching data...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
