'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFarm } from '@/lib/FarmContext';
import type { Icon } from 'leaflet';
import type { Map } from 'leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function Setup() {
  const [step, setStep] = useState(1);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);
  const [markerIcon, setMarkerIcon] = useState<Icon | null>(null);
  const mapRef = useRef<Map | null>(null);
  const { setFarmData } = useFarm();

  // Load the leaflet icon only on the client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then(leaflet => {
        const icon = new leaflet.default.Icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          shadowSize: [41, 41]
        });
        setMarkerIcon(icon);
      });
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMapClick = useCallback((e: any) => {
    const { lat: latitude, lng: longitude } = e.latlng;
    setLat(latitude);
    setLng(longitude);
    setMapCenter([latitude, longitude]);
  }, []);

  // Attach the click event listener to the map when it's ready and invalidate size
  useEffect(() => {
    if (mapRef.current) {
      const mapInstance = mapRef.current;
      mapInstance.on('click', handleMapClick);
      mapInstance.invalidateSize();
      return () => {
        mapInstance.off('click', handleMapClick);
      };
    }
  }, [handleMapClick]);

  const handleNext = () => {
    if (step === 1) {
      if (lat === null || lng === null) {
        alert('Please select a location on the map');
        return;
      }
      // Save location to farm data
      setFarmData({
        id: Date.now().toString(),
        name: `Farm ${Date.now()}`,
        location: { lat: lat!, lng: lng! },
        size: 0,
        soilType: '',
        currentCrop: ''
      });
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      // After completing all steps, go to field observatory
      // In a real app, we would use router.push('/field')
      alert('Setup complete! Redirecting to field view...');
      // For now, we just reset the form
      setStep(1);
      setLat(null);
      setLng(null);
      setMapCenter([0, 0]);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Setup Your Field</h1>
      <p className="mb-6">Let&apos;s get started by telling us about your farm.</p>

      {/* Stepper */}
      <div className="flex mb-6">
        <div
          className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-gray-300'} mr-2`}
        ></div>
        <div
          className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-gray-300'} mr-2`}
        ></div>
        <div
          className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-blue-500' : 'bg-gray-300'} mr-2`}
        ></div>
        <div
          className={`w-3 h-3 rounded-full ${step >= 4 ? 'bg-blue-500' : 'bg-gray-300'}`}
        ></div>
      </div>

      {/* Step Content */}
      {step === 1 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Step 1: Select Location</h2>
          <p className="mb-4">Click on the map to select your farm&apos;s location, or enter coordinates below.</p>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="w-full md:w-1/2">
              {markerIcon !== null ? (
                <MapContainer
                  ref={mapRef}
                  center={mapCenter}
                  zoom={lat && lng ? 13 : 2}
                  style={{ height: '400px', width: '100%', borderRadius: '8px' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {lat !== null && lng !== null && (
                    <Marker position={[lat, lng]} icon={markerIcon}>
                      <Popup>
                        Selected Location
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              ) : (
                <div style={{ height: '400px' }}>Loading map...</div>
              )}
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-3 py-2 border rounded"
                  value={lat !== null ? lat.toFixed(6) : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setLat(isNaN(val) ? null : val);
                  }}
                  placeholder="Enter latitude"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="w-full px-3 py-2 border rounded"
                  value={lng !== null ? lng.toFixed(6) : ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setLng(isNaN(val) ? null : val);
                  }}
                  placeholder="Enter longitude"
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {lat !== null && lng !== null ?
              `Selected: Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}` :
              'Please select a location on the map or enter coordinates'}
          </p>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 2: Field Details</h2>
          <p className="mb-4">Tell us about your field&apos;s characteristics.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Field Size (hectares)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="w-full px-3 py-2 border rounded"
                placeholder="Enter field size"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Soil Type</label>
              <select className="w-full px-3 py-2 border rounded">
                <option value="">Select soil type</option>
                <option value="sandy">Sandy</option>
                <option value="loam">Loam</option>
                <option value="clay">Clay</option>
                <option value="silt">Silt</option>
                <option value="peat">Peat</option>
                <option value="chalk">Chalk</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Current Crop (optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., corn, wheat, soybeans"
              />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 3: Priorities</h2>
          <p className="mb-4">What&apos;s most important to you? Rank the following by importance.</p>
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <input type="radio" name="priority" value="yield" className="h-4 w-4" />
              <span>Maximize Yield</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="radio" name="priority" value="soil" className="h-4 w-4" />
              <span>Improve Soil Health</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="radio" name="priority" value="water" className="h-4 w-4" />
              <span>Minimize Water Usage</span>
            </div>
            <div className="flex items-center space-x-3">
              <input type="radio" name="priority" value="profit" className="h-4 w-4" />
              <span>Maximize Profit</span>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Step 4: Constraints</h2>
          <p className="mb-4">Are there any constraints we should consider?</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Maximum Budget (optional)</label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 border rounded"
                placeholder="Enter budget in local currency"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time Constraint (optional)</label>
              <input
                type="date"
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        {step > 1 && (
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Back
          </button>
        )}
        {step < 4 && (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Next
          </button>
        )}
        {step === 4 && (
          <button
            onClick={handleNext}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}