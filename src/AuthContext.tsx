import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface AuthContextType {
    currentDoctor: { username: string; email: string } | null;
    login: (username: string, email: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentDoctor, setCurrentDoctor] = useState<{ username: string; email: string } | null>(
        null
    );

    const login = (username: string, email: string) => {
        setCurrentDoctor({ username, email });
    };

    const logout = () => {
        setCurrentDoctor(null);
    };

    return (
        <AuthContext.Provider value={{ currentDoctor, login, logout }}>
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
