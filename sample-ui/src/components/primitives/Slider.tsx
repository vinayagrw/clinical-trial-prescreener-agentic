/*
 * Slider primitive — wraps @radix-ui/react-slider.
 *
 * Used by:
 *   - WhatIfSimulator in /insights (criterion threshold slider)
 *   - ReadingLevelSlider in /portal (grade-level selector)
 *   - PI Review packet grade-level control
 */

import * as SliderPrimitive from "@radix-ui/react-slider";

export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step?: number;
  /** Labels the slider for screen readers. Required. */
  ariaLabel: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  ariaLabel,
  disabled,
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className="ctp-slider"
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <SliderPrimitive.Track className="ctp-slider-track">
        <SliderPrimitive.Range className="ctp-slider-range" />
      </SliderPrimitive.Track>
      {value.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="ctp-slider-thumb"
          aria-label={`${ariaLabel} value`}
        />
      ))}
    </SliderPrimitive.Root>
  );
}
