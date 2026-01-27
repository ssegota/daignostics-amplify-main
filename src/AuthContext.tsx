import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getCurrentUser, signIn, signOut, fetchUserAttributes, type SignInInput } from 'aws-amplify/auth';

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

    const determineRole = async (username: string, email?: string): Promise<'doctor' | 'patient' | 'unknown'> => {
        console.log('determineRole called with username:', username, 'email:', email);

        try {
            // Check if Doctor by username
            const doctorCheck = await client.models.Doctor.list({ filter: { username: { eq: username } } });
            console.log('Doctor check by username:', doctorCheck.data.length);
            if (doctorCheck.data.length > 0) return 'doctor';

            // Also check by email for doctors
            if (email) {
                const doctorEmailCheck = await client.models.Doctor.list({ filter: { email: { eq: email } } });
                console.log('Doctor check by email:', doctorEmailCheck.data.length);
                if (doctorEmailCheck.data.length > 0) return 'doctor';
            }
        } catch (e) {
            console.log('Doctor check error:', e);
            // Ignore (might not be a doctor)
        }

        try {
            // Check if Patient by cognitoId
            const patientCheck = await client.models.Patient.list({ filter: { cognitoId: { eq: username } } });
            console.log('Patient check by cognitoId:', patientCheck.data.length);
            if (patientCheck.data.length > 0) return 'patient';

            // Check by email for patients (since cognitoId is set to email during creation)
            if (email) {
                const patientEmailCheck = await client.models.Patient.list({ filter: { email: { eq: email } } });
                console.log('Patient check by email:', patientEmailCheck.data.length);
                if (patientEmailCheck.data.length > 0) return 'patient';
            }
        } catch (e) {
            console.log('Patient check error:', e);
            // Ignore
        }

        return 'unknown';
    };

    const checkUser = async () => {
        try {
            const user = await getCurrentUser();
            // Fetch user attributes to get email
            const attributes = await fetchUserAttributes();
            const email = attributes.email;
            console.log('checkUser - username:', user.username, 'email:', email);

            const role = await determineRole(user.username, email);
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
        // Ensure any existing session is cleared before attempting login
        try {
            await signOut();
        } catch (e) {
            // Ignore error if not signed in
        }

        const { isSignedIn, nextStep } = await signIn(input);
        if (isSignedIn) {
            const user = await getCurrentUser();
            // Fetch user attributes to get email
            const attributes = await fetchUserAttributes();
            const email = attributes.email;
            console.log('login - username:', user.username, 'email:', email);

            const role = await determineRole(user.username, email);
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
