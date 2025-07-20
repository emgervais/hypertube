import { useFetchWithAuth } from '../utils/fetchProtected';
import { useEffect, useState } from 'react';

export const PrivateRoute = ({ children }) => {
    const fetchWithAuth = useFetchWithAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const testToken = async () => {
            await fetchWithAuth(`/auth/tokenTest`);
            setLoading(false);
        };
        testToken();
    }, [fetchWithAuth]);

    if (loading) return <div>Loading...</div>;

    return children;
};