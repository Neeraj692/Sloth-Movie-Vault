import React, { useEffect } from 'react';

interface AdSenseProps {
  adSlot: string;
  adFormat?: 'auto' | 'fluid' | 'rectangle';
  fullWidthResponsive?: boolean;
}

export const AdSense: React.FC<AdSenseProps> = ({ 
  adSlot, 
  adFormat = 'auto', 
  fullWidthResponsive = true 
}) => {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('Google AdSense error:', err);
    }
  }, []);

  // Use the env variable if configured, otherwise fallback to the provided client ID
  const clientId = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT_ID || "ca-pub-1046049479859525";

  return (
    <ins
      className="adsbygoogle"
      style={{ display: 'block', minHeight: '90px' }}
      data-ad-client={clientId}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={fullWidthResponsive ? "true" : "false"}
    />
  );
};
