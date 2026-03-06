
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { Database, getDatabase, ref, get } from 'firebase/database';
import type { User as AppUserDef } from '@/lib/definitions';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  database: Database;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  appUser: AppUserDef | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; // The Auth service instance
  database: Database | null;
  // User authentication state
  user: User | null;
  appUser: AppUserDef | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  database: Database;
  user: User | null;
  appUser: AppUserDef | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { 
  user: User | null;
  appUser: AppUserDef | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  database,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    appUser: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });

  // Effect to subscribe to Firebase auth state changes
  useEffect(() => {
    if (!auth) { // If no Auth service instance, cannot determine user state
      setUserAuthState({ user: null, appUser: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
      return;
    }

    setUserAuthState(prev => ({ ...prev, isUserLoading: true })); // Reset on auth instance change

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => { // Auth state determined
        if (firebaseUser) {
          const appUserId = localStorage.getItem('app_user_id');
          if (appUserId) {
            try {
              const db = getDatabase();
              const userSnapshot = await get(ref(db, `users/${appUserId}`));
              if (userSnapshot.exists()) {
                const appUserData = userSnapshot.val();
                
                // Ensure permissions are always an array
                let userPerms: string[] = [];
                if (appUserData.permissions) {
                    if (Array.isArray(appUserData.permissions)) {
                        userPerms = appUserData.permissions;
                    } else if (typeof appUserData.permissions === 'object') {
                        userPerms = Object.values(appUserData.permissions);
                    }
                }
                appUserData.permissions = userPerms;

                setUserAuthState({ user: firebaseUser, appUser: { id: appUserId, ...appUserData }, isUserLoading: false, userError: null });
              } else {
                 setUserAuthState({ user: firebaseUser, appUser: null, isUserLoading: false, userError: null });
              }
            } catch (error: any) {
              console.error("Failed to fetch app user data:", error);
              setUserAuthState({ user: firebaseUser, appUser: null, isUserLoading: false, userError: error });
            }
          } else {
             setUserAuthState({ user: firebaseUser, appUser: null, isUserLoading: false, userError: null });
          }
        } else {
          setUserAuthState({ user: null, appUser: null, isUserLoading: false, userError: null });
        }
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, appUser: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth]); // Depends on the auth instance

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && database);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      database: servicesAvailable ? database : null,
      user: userAuthState.user,
      appUser: userAuthState.appUser,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
    };
  }, [firebaseApp, firestore, auth, database, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.database) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    database: context.database,
    user: context.user,
    appUser: context.appUser,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

/** Hook to access Realtime Database instance. */
export const useDatabase = (): Database => {
  const { database } = useFirebase();
  return database;
}

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => {
  const { user, appUser, isUserLoading, userError } = useFirebase();
  return { user, appUser, isUserLoading, userError };
};
