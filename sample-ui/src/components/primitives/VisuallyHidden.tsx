/*
 * Re-export of Radix VisuallyHidden. Exists as a wrapper only so house code
 * imports from `components/primitives` and doesn't have to know the Radix
 * package name.
 */

import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";

export const VisuallyHidden = VisuallyHiddenPrimitive.Root;
