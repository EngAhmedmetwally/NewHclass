
'use client';

import { useMemo } from 'react';
import { useUser } from '@/firebase';
import type { PermissionId } from '@/lib/permissions';

// Converts 'some:thing-else' to 'someThingElse'
const toCamelCase = (str: string): string => {
  return str.replace(/[:_-](.)/g, (_, c) => c.toUpperCase());
};

// Generates a type like { canProductsAdd: boolean, canOrdersEdit: boolean }
type PermissionsMap<T extends readonly PermissionId[]> = {
  [P in T[number] as `can${Capitalize<ReturnType<typeof toCamelCase>>}`]: boolean;
};


type UsePermissionsReturn<T extends readonly PermissionId[]> = {
  isLoading: boolean;
  permissions: PermissionsMap<T>;
};

export function usePermissions<const T extends readonly PermissionId[]>(requiredPermissions: T): UsePermissionsReturn<T> {
  const { appUser, isUserLoading } = useUser();

  const permissions = useMemo(() => {
    const userPerms = appUser?.permissions || [];
    const isAdmin = userPerms.includes('all');

    const calculatedPermissions = {} as PermissionsMap<T>;
    
    requiredPermissions.forEach(p => {
      const key = `can${toCamelCase(p).charAt(0).toUpperCase() + toCamelCase(p).slice(1)}` as keyof PermissionsMap<T>;
      (calculatedPermissions[key] as boolean) = isAdmin || userPerms.includes(p);
    });

    return calculatedPermissions;
  }, [appUser, requiredPermissions]);

  return { isLoading: isUserLoading, permissions };
}
