'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface FarmData {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  size: number; // in hectares
  soilType: string;
  currentCrop: string;
  // Add more fields as needed
}

interface FarmContextType {
  farmData: FarmData | null;
  setFarmData: (data: FarmData) => void;
  clearFarmData: () => void;
}

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const useFarm = () => {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within a FarmProvider');
  }
  return context;
};

export const FarmProvider = ({ children }: { children: React.ReactNode }) => {
  const [farmData, setFarmData] = useState<FarmData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('farmData');
    if (saved) {
      setFarmData(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (farmData) {
      localStorage.setItem('farmData', JSON.stringify(farmData));
    } else {
      localStorage.removeItem('farmData');
    }
  }, [farmData]);

  const clearFarmData = () => {
    setFarmData(null);
  };

  return (
    <FarmContext.Provider value={{ farmData, setFarmData, clearFarmData }}>
      {children}
    </FarmContext.Provider>
  );
};