import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { ModelOption } from '../../types/chat';

export interface ModelSelectorProps {
  models?: ModelOption[];
  selectedModelId?: string;
  onSelectModel?: (id: string) => void;
  selectedEffortId?: string;
  onSelectEffort?: (effortId: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models = [],
  selectedModelId,
  onSelectModel,
  selectedEffortId,
  onSelectEffort,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'main' | 'effort' | 'models'>('main');
  const [positionStyle, setPositionStyle] = useState<{
    placement: 'top' | 'bottom';
    maxHeight: number;
  }>({
    placement: 'top',
    maxHeight: 380,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Compute available space and dynamic position relative to the chat box container
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const triggerRect = containerRef.current.getBoundingClientRect();

    // Nearest boundary: chat workspace main, chat suite root, or viewport
    const boundary =
      containerRef.current.closest('main') ||
      containerRef.current.closest('.ai-chat-suite-root') ||
      document.documentElement;
    const boundaryRect = boundary.getBoundingClientRect();

    // Available vertical space above and below the trigger pill inside the chat box
    const spaceAbove = triggerRect.top - boundaryRect.top - 12; // 12px margin
    const spaceBelow = boundaryRect.bottom - triggerRect.bottom - 12; // 12px margin

    // Determine placement: open upward by default, flip downward if upward space is too constrained
    const shouldFlip = spaceAbove < 200 && spaceBelow > spaceAbove;
    const availableSpace = shouldFlip ? spaceBelow : spaceAbove;

    // Clamp maxHeight to available space so top never exceeds chat box boundaries
    const clampedMaxHeight = Math.max(140, Math.min(420, Math.floor(availableSpace)));

    setPositionStyle({
      placement: shouldFlip ? 'bottom' : 'top',
      maxHeight: clampedMaxHeight,
    });
  }, []);

  // Update position on open and whenever viewport / chat container scrolls or resizes
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, view, updatePosition]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setView('main');
      }
    };

    if (isOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Keyboard navigation (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (view !== 'main') {
          setView('main');
        } else {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view]);

  if (!models || models.length === 0) return null;

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

  // Active effort level
  const effortLevels = activeModel?.effortLevels || [];
  const hasEffort = effortLevels.length > 0;
  const activeEffort =
    effortLevels.find((e) => e.id === selectedEffortId) || (hasEffort ? effortLevels[0] : undefined);

  // Split primary and secondary models for "More models"
  const explicitSecondary = models.filter((m) => m.isSecondary);
  let primaryModels: ModelOption[];
  let secondaryModels: ModelOption[];

  if (explicitSecondary.length > 0) {
    primaryModels = models.filter((m) => !m.isSecondary);
    secondaryModels = explicitSecondary;
  } else if (models.length > 3) {
    primaryModels = models.slice(0, 2);
    secondaryModels = models.slice(2);
  } else {
    primaryModels = models;
    secondaryModels = [];
  }

  const isTop = positionStyle.placement === 'top';
  const positionClass = isTop ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div ref={containerRef} className="relative select-none text-xs">
      {/* Claude-style Pill Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setView('main');
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#232326] hover:bg-slate-200 dark:hover:bg-[#2c2c30] text-slate-700 dark:text-slate-200 font-medium transition-colors shadow-2xs border border-slate-200/60 dark:border-white/5"
        title="Choose Model & Effort"
      >
        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[120px] sm:max-w-[160px]">
          {activeModel?.name}
        </span>
        {hasEffort && activeEffort && (
          <span className="text-slate-400 dark:text-slate-400 font-normal">
            {activeEffort.label}
          </span>
        )}
      </button>

      {/* Popover Menu Card */}
      {isOpen && (
        <div
          style={{ maxHeight: `${positionStyle.maxHeight}px` }}
          className={`absolute ${positionClass} right-0 z-50 w-72 bg-white dark:bg-[#1a1a1c] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 text-slate-800 dark:text-slate-200 flex flex-col animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Main View */}
          {view === 'main' && (
            <>
              <div className="overflow-y-auto flex-1 min-h-0 space-y-1 pr-0.5">
                {/* Primary Model Options */}
                {primaryModels.map((model) => {
                  const isSelected = model.id === activeModel?.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel?.(model.id);
                        if (model.effortLevels && model.effortLevels.length > 0) {
                          onSelectEffort?.(model.effortLevels[0].id);
                        }
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-white/10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{model.name}</span>
                          {model.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono">
                              {model.badge}
                            </span>
                          )}
                        </div>
                        {model.description && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                            {model.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}

                {/* Effort Row (if supported by active model) */}
                {hasEffort && (
                  <div className="pt-1 mt-1 border-t border-slate-100 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setView('effort')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">Effort</span>
                      <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200">
                        <span className="font-normal text-xs">{activeEffort?.label || 'Medium'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  </div>
                )}

                {/* More Models Row (if secondary models exist) */}
                {secondaryModels.length > 0 && (
                  <div className={hasEffort ? '' : 'pt-1 mt-1 border-t border-slate-100 dark:border-white/5'}>
                    <button
                      type="button"
                      onClick={() => setView('models')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">More models</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                    </button>
                  </div>
                )}
              </div>

              {/* Footer note matching Claude screenshot */}
              <div className="mt-1 pt-2 border-t border-slate-100 dark:border-white/5 px-2 py-1 text-[10.5px] text-slate-400 dark:text-slate-500 leading-tight flex-shrink-0">
                Models and thinking effort configure reasoning depth for each request.
              </div>
            </>
          )}

          {/* Effort Sub-View */}
          {view === 'effort' && (
            <>
              <div className="flex items-center gap-1.5 pb-2 mb-1 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setView('main')}
                  className="p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Back to models"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                  Reasoning Effort
                </span>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 space-y-1 pr-0.5">
                {effortLevels.map((effort) => {
                  const isSelected = effort.id === activeEffort?.id;
                  return (
                    <button
                      key={effort.id}
                      type="button"
                      onClick={() => {
                        onSelectEffort?.(effort.id);
                        setView('main');
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-white/10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                          {effort.label}
                        </div>
                        {effort.description && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {effort.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* More Models Sub-View */}
          {view === 'models' && (
            <>
              <div className="flex items-center gap-1.5 pb-2 mb-1 border-b border-slate-100 dark:border-white/5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setView('main')}
                  className="p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                  title="Back to models"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">
                  Additional Models
                </span>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 space-y-1 pr-0.5">
                {secondaryModels.map((model) => {
                  const isSelected = model.id === activeModel?.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onSelectModel?.(model.id);
                        if (model.effortLevels && model.effortLevels.length > 0) {
                          onSelectEffort?.(model.effortLevels[0].id);
                        }
                        setView('main');
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                        isSelected
                          ? 'bg-slate-100 dark:bg-white/10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{model.name}</span>
                          {model.badge && (
                            <span className="px-1 py-0.2 rounded text-[8px] bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono">
                              {model.badge}
                            </span>
                          )}
                        </div>
                        {model.description && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {model.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

