
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { getDatabase, ref, get } from "firebase/database";
import type { User as AppUser } from './definitions';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hasPermission(
    appUser: AppUser | null | undefined, 
    requiredPermission: string
): Promise<boolean> {
  if (!appUser || !appUser.permissions) return false;

  // The user with 'all' permission bypasses all checks.
  if (appUser.permissions.includes('all')) return true;

  // For all other users, check if their permissions array includes the required permission.
  if (appUser.permissions.includes(requiredPermission)) return true;
  
  return false;
}

// Standard DPI for screen-to-print conversion
const DPI = 96;
const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

export const mmToPx = (mm: number) => (mm / MM_PER_INCH) * DPI;
export const ptToPx = (pt: number) => (pt / PT_PER_INCH) * DPI;
