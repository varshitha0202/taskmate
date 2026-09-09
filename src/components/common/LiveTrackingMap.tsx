import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Coordinates {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  pickupLocation: Coordinates;
  destinationLocation?: Coordinates;
  agentLocation?: Coordinates;
  agentName?: string;
  agentAvatar?: string;
  height?: string;
  className?: string;
  zoom?: number;
}

export const LiveTrackingMap: React.FC<Props> = ({
  pickupLocation,
  destinationLocation,
  agentLocation,
  agentName = 'Agent',
  agentAvatar,
  height = '360px',
  className = '',
  zoom = 14,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{
    pickup?: L.Marker;
    destination?: L.Marker;
    agent?: L.Marker;
    route?: L.Polyline;
  }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize map centered at pickup
      const map = L.map(mapContainerRef.current, {
        center: [pickupLocation.lat, pickupLocation.lng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Custom Icons
    const createPickupIcon = () =>
      L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold ring-4 ring-indigo-100">
              P
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

    const createDestinationIcon = () =>
      L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg border-2 border-white text-xs font-bold ring-4 ring-rose-100">
              D
            </span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

    const createAgentIcon = () =>
      L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="w-10 h-10 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-emerald-200 animate-pulse">
              ${
                agentAvatar
                  ? `<img src="${agentAvatar}" class="w-full h-full rounded-full object-cover"/>`
                  : '<span class="text-sm font-black">A</span>'
              }
            </div>
            <span class="mt-1 px-2 py-0.5 bg-slate-900/90 text-white text-[10px] font-bold rounded-full whitespace-nowrap shadow-md">
              ${agentName}
            </span>
          </div>
        `,
        iconSize: [40, 48],
        iconAnchor: [20, 24],
      });

    // 1. Update/Add Pickup Marker
    if (markersRef.current.pickup) {
      markersRef.current.pickup.setLatLng([pickupLocation.lat, pickupLocation.lng]);
    } else {
      markersRef.current.pickup = L.marker([pickupLocation.lat, pickupLocation.lng], {
        icon: createPickupIcon(),
      })
        .addTo(map)
        .bindPopup(`<b>Pickup Location</b><br/>${pickupLocation.label || 'Task location'}`);
    }

    // 2. Update/Add Destination Marker
    if (destinationLocation) {
      if (markersRef.current.destination) {
        markersRef.current.destination.setLatLng([destinationLocation.lat, destinationLocation.lng]);
      } else {
        markersRef.current.destination = L.marker(
          [destinationLocation.lat, destinationLocation.lng],
          { icon: createDestinationIcon() }
        )
          .addTo(map)
          .bindPopup(`<b>Destination</b><br/>${destinationLocation.label || 'Delivery point'}`);
      }
    }

    // 3. Update/Add Agent Marker (Live location updates smoothly here!)
    const allCoords: L.LatLngExpression[] = [[pickupLocation.lat, pickupLocation.lng]];

    if (agentLocation) {
      allCoords.push([agentLocation.lat, agentLocation.lng]);
      if (markersRef.current.agent) {
        markersRef.current.agent.setLatLng([agentLocation.lat, agentLocation.lng]);
      } else {
        markersRef.current.agent = L.marker([agentLocation.lat, agentLocation.lng], {
          icon: createAgentIcon(),
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup(`<b>${agentName}</b><br/>Live GPS Location`);
      }
    } else if (markersRef.current.agent) {
      markersRef.current.agent.remove();
      markersRef.current.agent = undefined;
    }

    if (destinationLocation) {
      allCoords.push([destinationLocation.lat, destinationLocation.lng]);
    }

    // 4. Draw/Update Polyline
    if (markersRef.current.route) {
      markersRef.current.route.remove();
    }

    if (agentLocation) {
      markersRef.current.route = L.polyline(
        [[agentLocation.lat, agentLocation.lng], [pickupLocation.lat, pickupLocation.lng]],
        {
          color: '#4f46e5',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }
      ).addTo(map);
    } else if (destinationLocation) {
      markersRef.current.route = L.polyline(
        [[pickupLocation.lat, pickupLocation.lng], [destinationLocation.lat, destinationLocation.lng]],
        {
          color: '#4f46e5',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }
      ).addTo(map);
    }

    // Fit map bounds to view all active points
    if (allCoords.length > 1) {
      map.fitBounds(L.latLngBounds(allCoords), {
        padding: [50, 50],
        maxZoom: 16,
      });
    } else {
      map.setView([pickupLocation.lat, pickupLocation.lng], zoom);
    }

    // Invalidate size on container change
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      // Map instance preserved for smooth realtime updates
    };
  }, [pickupLocation, destinationLocation, agentLocation, agentName, agentAvatar, zoom]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden border border-slate-200/80 shadow-inner relative z-10 ${className}`}
    />
  );
};
