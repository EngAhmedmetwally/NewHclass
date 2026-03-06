'use client';

import { Button } from './ui/button';
import { Delete } from 'lucide-react';

type NumpadProps = {
  onInput: (value: string) => void;
  onClear: () => void;
  onBackspace: () => void;
};

export function Numpad({ onInput, onClear, onBackspace }: NumpadProps) {
  const buttons = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map((num) => (
        <Button
          key={num}
          variant="outline"
          className="h-16 text-2xl font-bold"
          onClick={() => onInput(num)}
        >
          {num}
        </Button>
      ))}
      <Button
        variant="outline"
        className="h-16 text-2xl font-bold"
        onClick={onClear}
      >
        C
      </Button>
      <Button
        variant="outline"
        className="h-16 text-2xl font-bold"
        onClick={() => onInput('0')}
      >
        0
      </Button>
      <Button
        variant="outline"
        className="h-16"
        onClick={onBackspace}
      >
        <Delete className="h-6 w-6" />
      </Button>
    </div>
  );
}
