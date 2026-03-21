import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './BottomNav.css'

const BottomNav = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bottom-nav">
      <div className="nav-container">
        <button 
          className={`nav-item ${isActive('/claim') ? 'active' : ''}`}
          onClick={() => navigate('/claim')}
        >
          <span className="material-symbols-outlined">edit_note</span>
          <span className="nav-label">기록하기</span>
        </button>
        <button 
          className={`nav-item ${isActive('/history') ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          <span className="material-symbols-outlined">history</span>
          <span className="nav-label">내역</span>
        </button>
        <button 
          className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
        >
          <span className="material-symbols-outlined">person</span>
          <span className="nav-label">내 정보</span>
        </button>
      </div>
    </nav>
  )
}

export default BottomNav
