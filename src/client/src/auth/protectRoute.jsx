import { useFetchWithAuth } from '../utils/fetchProtected';

export const PrivateRoute = ({ children }) => {
    const fetchWithAuth = useFetchWithAuth();
    const testToken = async () => {
        await fetchWithAuth(`/auth/tokenTest`)
    }
    testToken();

    return children;
};