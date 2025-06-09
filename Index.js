// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard'; // Adjust path
import LoginPage from './components/LoginPage'; // Assuming you have a login page

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} /> {/* Your login page */}
        <Route path="/admin" element={<AdminDashboard />} /> {/* Route to your dashboard */}
        {/* You might have other routes like for individual moments */}
        <Route path="/moment/:id" element={<div>Moment Detail Page (placeholder)</div>} />
        {/* Add more routes as needed */}
      </Routes>
    </Router>
  );
}

export default App;
