import React, { createContext, useContext, useEffect, useState } from 'react';
import { checkHealth } from './api';

const ApiHealthContext = createContext();

export const ApiHealthProvider = ({ children }) => {
  const [status, setStatus] = useState('loading'); // 'loading', 'online', 'offline'
  const [lastCheck, setLastCheck] = useState(Date.now());

  useEffect(() => {
    let interval;
    const startTime = Date.now();

    const performCheck = async () => {
      try {
        const data = await checkHealth();
        if (data.status === 'ok') {
          setStatus('online');
          if (interval) clearInterval(interval);
        }
      } catch (error) {
        console.log('API is waking up...');
        setLastCheck(Date.now());
        
        // Se já passou de 2 minutos tentando, seta como offline
        if (Date.now() - startTime >= 120000) {
          setStatus('offline');
          if (interval) clearInterval(interval);
        }
      }
    };

    // Initial check
    performCheck();

    // Retry every 10 seconds
    interval = setInterval(performCheck, 10000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <ApiHealthContext.Provider value={{ status, retry: () => window.location.reload() }}>
      {children}
    </ApiHealthContext.Provider>
  );
};

export const useApiHealth = () => useContext(ApiHealthContext);
