import { useEffect, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';

export default function Map() {
    const mapContainer = useRef(null);
    const map = useRef(null);

    useEffect(() => {
        if (map.current) return;

        maptilersdk.config.apiKey = 'y2NlgmZepLfYwrkhzqcV';

        map.current = new maptilersdk.Map({
            container: mapContainer.current,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilersdk.config.apiKey}`,
            center: [0, 0],
            zoom: 2
        });

        map.current.on('load', () => {
            console.log('Map loaded successfully!');
        });

    }, []);

    return (
        <div
            ref={mapContainer}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
            }}
        />
    );
}
