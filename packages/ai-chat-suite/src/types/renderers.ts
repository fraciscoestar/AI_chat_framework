import { ComponentType } from 'react';

export interface CustomRendererProps {
  content: string;
  language: string;
  filename?: string;
  isArtifact?: boolean;
  onSave?: (newContent: string) => void;
  metadata?: Record<string, unknown>;
  className?: string;
}

export type CustomRendererComponent = ComponentType<CustomRendererProps>;

export type RendererRegistry = Record<string, CustomRendererComponent>;
