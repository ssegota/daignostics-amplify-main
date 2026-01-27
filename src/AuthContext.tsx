import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getCurrentUser, signIn, signOut, type SignInInput } from 'aws-amplify/auth';

interface AuthContextType {
    currentDoctor: { username: string; email?: string } | null;
    login: (input: SignInInput) => Promise<void>;
    logout: () => Promise<void>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentDoctor, setCurrentDoctor] = useState<{ username: string; email?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        checkUser();
    }, []);

    const checkUser = async () => {
        try {
            const user = await getCurrentUser();
            setCurrentDoctor({
                username: user.username,
                // We could fetch attributes here if needed, but username is sufficient for now
            });
        } catch (error) {
            setCurrentDoctor(null);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (input: SignInInput) => {
        const { isSignedIn, nextStep } = await signIn(input);
        if (isSignedIn) {
            const user = await getCurrentUser();
            setCurrentDoctor({ username: user.username });
        } else {
            // Handle next steps like NEW_PASSWORD_REQUIRED if needed
            console.log('Next step required:', nextStep);
        }
    };

    const logout = async () => {
        await signOut();
        setCurrentDoctor(null);
    };

    return (
        <AuthContext.Provider value={{ currentDoctor, login, logout, isLoading }}>
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
