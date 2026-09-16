import React, { createContext, useContext, useMemo } from 'react';
import { RendererRegistry, CustomRendererComponent } from '../types/renderers';

const RendererContext = createContext<RendererRegistry>({});

export interface RendererProviderProps {
  renderers?: RendererRegistry;
  children: React.ReactNode;
}

export const RendererProvider: React.FC<RendererProviderProps> = ({ renderers = {}, children }) => {
  const value = useMemo(() => renderers, [renderers]);
  return <RendererContext.Provider value={value}>{children}</RendererContext.Provider>;
};

export function useRendererRegistry(): RendererRegistry {
  return useContext(RendererContext);
}

/**
 * Resolves a custom renderer by language identifier or file extension.
 * E.g., 'kicad', '.kicad_sch', 'kicad_sch'
 */
export function resolveCustomRenderer(
  key: string,
  registry: RendererRegistry = {}
): CustomRendererComponent | null {
  if (!key) return null;
  const cleanKey = key.toLowerCase().replace(/^\./, '');

  if (registry[cleanKey]) {
    return registry[cleanKey];
  }
  if (registry[key]) {
    return registry[key];
  }

  return null;
}
