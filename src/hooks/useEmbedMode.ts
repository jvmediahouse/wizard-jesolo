import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type EmbedMode = 'standalone' | 'widget' | 'page';

export function useEmbedMode() {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const embedValue = searchParams.get('embed');

    if (embedValue === 'widget') {
      return {
        mode: 'widget' as const,
        isEmbedded: true,
      };
    }

    if (embedValue === 'page' || embedValue === '1' || embedValue === 'true') {
      return {
        mode: 'page' as const,
        isEmbedded: true,
      };
    }

    return {
      mode: 'standalone' as const,
      isEmbedded: false,
    };
  }, [searchParams]);
}