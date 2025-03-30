export const PrivateRoute = ({ children }) => {
    const accessToken = useAuth();

    if (!accessToken) {
        return <Navigate to="/login" />;
    }

    return children;
};