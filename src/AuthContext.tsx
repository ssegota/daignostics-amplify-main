import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getCurrentUser, signIn, signOut, type SignInInput } from 'aws-amplify/auth';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();

interface AuthContextType {
    currentUser: { username: string; role: 'doctor' | 'patient' | 'unknown' } | null;
    login: (input: SignInInput) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<{ username: string; role: 'doctor' | 'patient' | 'unknown' } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkUser();
    }, []);

    const determineRole = async (username: string): Promise<'doctor' | 'patient' | 'unknown'> => {
        try {
            // Check if Doctor
            // Doctor might not use 'username' as PK in the generated client if id is auto-generated
            // So we use list with filter to be safe
            const doctorCheck = await client.models.Doctor.list({ filter: { username: { eq: username } } });
            if (doctorCheck.data.length > 0) return 'doctor';
        } catch (e) {
            // Ignore (might not be a doctor)
        }

        try {
            // Check if Patient
            // Patient primary key is 'id', so we filter by cognitoId
            const patientCheck = await client.models.Patient.list({ filter: { cognitoId: { eq: username } } });
            if (patientCheck.data.length > 0) return 'patient';
        } catch (e) {
            // Ignore
        }

        return 'unknown';
    };

    const checkUser = async () => {
        try {
            const user = await getCurrentUser();
            const role = await determineRole(user.username);
            setCurrentUser({
                username: user.username,
                role
            });
        } catch (error) {
            setCurrentUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (input: SignInInput) => {
        const { isSignedIn, nextStep } = await signIn(input);
        if (isSignedIn) {
            const user = await getCurrentUser();
            const role = await determineRole(user.username);
            setCurrentUser({ username: user.username, role });
        } else {
            console.log('Next step required:', nextStep);
        }
    };

    const logout = async () => {
        await signOut();
        setCurrentUser(null);
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
