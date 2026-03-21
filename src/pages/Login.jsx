import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'
import './Login.css'

const Login = () => {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      // Firebase Auth는 이메일 형식을 필수로 하므로, 
      // 사용자 ID 뒤에 임의의 도메인을 붙여 이메일 로그인처럼 처리 (예: test@day100.com)
      const userEmail = id.includes('@') ? id : `${id}@day100.com`;
      
      await signInWithEmailAndPassword(auth, userEmail, password)
      console.log('Login successful:', id)
      
      // 관리자 계정 여부를 확인 (단순 예시: id가 admin이면 관리자 페이지로)
      if (id === 'admin') {
        navigate('/admin')
      } else {
        navigate('/claim')
      }
    } catch (err) {
      console.error('Login error:', err.message)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('아이디 또는 비밀번호가 일치하지 않습니다.')
      } else {
        setError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <main className="login-main">
        {/* 헤더 섹션: 브랜드 로고 및 타이틀 */}
        <header className="login-header">
          <div className="login-logo">
            <svg className="logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
            </svg>
          </div>
          <h1 className="brand-name">일당백</h1>
          <p className="brand-slogan">노동자를 위한 든든한 파트너</p>
        </header>

        {/* 로그인 폼 섹션 */}
        <section className="login-form-area">
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-field">
              <label htmlFor="user-id">아이디</label>
              <input
                type="text"
                id="user-id"
                placeholder="아이디를 입력하세요"
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
            </div>
            <div className="input-field">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {error && <p className="error-message">{error}</p>}
            
            <button type="submit" className="btn-login" disabled={isLoading}>
              {isLoading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </section>

        {/* 하단 유틸리티 링크 (회원가입, 비번찾기) */}
        <nav className="login-utils">
          <Link to="/signup" className="util-link">회원가입</Link>
          <span className="divider"></span>
          <Link to="/find-id" className="util-link">ID/PW 찾기</Link>
        </nav>

        {/* 푸터 정보 */}
        <footer className="login-footer">
          <p className="copyright">© 2026 일당백 (Day100). All rights reserved.</p>
        </footer>
      </main>
    </div>
  )
}

export default Login
