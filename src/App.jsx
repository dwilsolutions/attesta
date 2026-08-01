import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./components/AuthProvider.jsx";
import { AuthProvider } from "./components/AuthProvider.jsx";
import Login from "./routes/Login.jsx";
import Onboarding from "./routes/Onboarding.jsx";
import Shell from "./routes/Shell.jsx";
import Review from "./routes/review/Review.jsx";
import Family from "./routes/review/Family.jsx";

function Guard({ children }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboard" element={<Guard><Onboarding /></Guard>} />
        <Route path="/" element={<Guard><Shell /></Guard>}>
          <Route index element={<Review />} />
          <Route path="review" element={<Review />} />
          <Route path="review/:family" element={<Family />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
