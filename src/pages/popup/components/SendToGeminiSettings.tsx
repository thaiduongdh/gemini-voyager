import React, { useEffect, useState, useCallback } from 'react';

import { Card, CardContent, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Button } from '../../../components/ui/button';
import { STORAGE_KEYS } from '../../../shared/modules/sendToGemini/storage';
import type { GeminiModel, TargetTab } from '../../../shared/modules/sendToGemini/types';

import { storageFacade } from '@/core/services/StorageFacade';
import type { StorageKey } from '@/core/types/common';

interface SendToGeminiSettingsProps {
    t: (key: string) => string;
}

type StorageKey = keyof typeof STORAGE_KEYS;

export function SendToGeminiSettings({ t }: SendToGeminiSettingsProps) {
    const [enabled, setEnabled] = useState<boolean>(true);
    const [advancedMenu, setAdvancedMenu] = useState<boolean>(false);
    const [model, setModel] = useState<GeminiModel>('default');
    const [targetTab, setTargetTab] = useState<TargetTab>('new');
    const [queueCount, setQueueCount] = useState<number>(0);

    // Load initial values
    useEffect(() => {
        void storageFacade.getDataMap(
            {
                [STORAGE_KEYS.enabled]: true,
                [STORAGE_KEYS.advancedMenu]: false,
                [STORAGE_KEYS.model]: 'default',
                [STORAGE_KEYS.targetTab]: 'new',
                [STORAGE_KEYS.queue]: [],
            },
            (result) => {
                setEnabled(result[STORAGE_KEYS.enabled] !== false);
                setAdvancedMenu(result[STORAGE_KEYS.advancedMenu] === true);
                setModel((result[STORAGE_KEYS.model] as GeminiModel) || 'default');
                setTargetTab((result[STORAGE_KEYS.targetTab] as TargetTab) || 'new');
                const queue = Array.isArray(result[STORAGE_KEYS.queue]) ? (result[STORAGE_KEYS.queue] as unknown[]) : [];
                setQueueCount(queue.length);
            }
        );

        // Listen for queue changes
        const unsubscribe = storageFacade.subscribe(
            STORAGE_KEYS.queue,
            (change, areaName) => {
                if (areaName !== 'local') return;
                const queue = Array.isArray(change.newValue)
                    ? (change.newValue as unknown[])
                    : [];
                setQueueCount(queue.length);
            },
            { area: 'local' }
        );
        return () => unsubscribe();
    }, []);

    const updateSetting = useCallback(<T,>(key: StorageKey, value: T) => {
        void storageFacade.setData(key, value);
    }, []);

    const handleClearQueue = useCallback(() => {
        void storageFacade.setData(STORAGE_KEYS.queue, []);
    }, []);

    return (
        <Card className="p-3 hover:shadow-sm transition-shadow">
            <CardTitle className="mb-3 text-xs uppercase text-muted-foreground">
                Send to Gemini (YouTube)
            </CardTitle>
            <CardContent className="p-0 space-y-3">
                {/* Enable YouTube Bubble */}
                <div className="flex items-center justify-between group">
                    <div className="space-y-0.5">
                        <Label htmlFor="stg-enabled" className="cursor-pointer text-xs font-medium">
                            Show YouTube floating bubble
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                            Floating button on YouTube for quick actions
                        </p>
                    </div>
                    <Switch
                        id="stg-enabled"
                        checked={enabled}
                        className="scale-90"
                        onChange={(e) => {
                            setEnabled(e.target.checked);
                            updateSetting(STORAGE_KEYS.enabled, e.target.checked);
                        }}
                    />
                </div>

                {/* Advanced Context Menu */}
                <div className="flex items-center justify-between group">
                    <div className="space-y-0.5">
                        <Label htmlFor="stg-advanced" className="cursor-pointer text-xs font-medium">
                            Advanced context menu
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                            Show more options in right-click menu
                        </p>
                    </div>
                    <Switch
                        id="stg-advanced"
                        checked={advancedMenu}
                        className="scale-90"
                        onChange={(e) => {
                            setAdvancedMenu(e.target.checked);
                            updateSetting(STORAGE_KEYS.advancedMenu, e.target.checked);
                        }}
                    />
                </div>

                <div className="h-px bg-border/50 my-2" />

                {/* Gemini Model */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Gemini Model</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                        {(['default', 'flash', 'pro'] as GeminiModel[]).map((m) => (
                            <button
                                key={m}
                                onClick={() => {
                                    setModel(m);
                                    updateSetting(STORAGE_KEYS.model, m);
                                }}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${model === m
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Target Tab */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Open in</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                        {(['new', 'active'] as TargetTab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setTargetTab(tab);
                                    updateSetting(STORAGE_KEYS.targetTab, tab);
                                }}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all ${targetTab === tab
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    }`}
                            >
                                {tab === 'new' ? 'New Tab' : 'Current Tab'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-px bg-border/50 my-2" />

                {/* Queue Status */}
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <span className="text-xs font-medium">Video Queue</span>
                        <p className="text-[10px] text-muted-foreground">
                            {queueCount} item{queueCount !== 1 ? 's' : ''} queued
                        </p>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleClearQueue}
                        disabled={queueCount === 0}
                        className="text-xs h-7 px-2"
                    >
                        Clear Queue
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
