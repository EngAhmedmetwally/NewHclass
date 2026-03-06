"use client";

import { useState, useEffect } from 'react';

function getValue<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') {
        return defaultValue;
    }
    const saved = localStorage.getItem(key);
    // @ts-ignore
    const initial = saved !== null ? JSON.parse(saved) : defaultValue;
    return initial;
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => getValue(key, defaultValue));

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}
