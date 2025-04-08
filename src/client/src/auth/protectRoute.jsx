import {useAuth} from '../components/auth/authContext.jsx'
import { useFetchWithAuth } from '../utils/fetchProtected';

export const PrivateRoute = ({ children }) => {
    const fetchWithAuth = useFetchWithAuth();
    const testToken = async () => {
        await fetchWithAuth(`/user/a`)
    }
    testToken();

    return children;
};