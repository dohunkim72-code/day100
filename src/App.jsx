import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import FindAccount from './pages/FindAccount'
import Signup from './pages/Signup'
import Claim from './pages/Claim'
import History from './pages/History'

import Profile from './pages/Profile'
import Admin from './pages/Admin'
import AdminLogin from './pages/AdminLogin'
import Privacy from './pages/Privacy'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/find-id" element={<FindAccount />} />
        <Route path="/find-pw" element={<FindAccount />} />
        <Route path="/history" element={<History />} />
        <Route path="/claim" element={<Claim />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </Router>
  )
}

export default App
