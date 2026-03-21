import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { db } from '../firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import './FindAccount.css'

const FindAccount = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  const [activeTab, setActiveTab] = useState(location.pathname === '/find-pw' ? 'find-pw' : 'find-id') 
  const [phone, setPhone] = useState('')
  const [userIdInput, setUserIdInput] = useState('')
  const [foundId, setFoundId] = useState('')
  const [showIdPopup, setShowIdPopup] = useState(false)
  const [showErrorPopup, setShowErrorPopup] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showPwSuccess, setShowPwSuccess] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  const handleFindId = async (e) => {
    e.preventDefault()
    setIsSearching(true)
    
    try {
      const q = query(collection(db, "users"), where("phone", "==", phone))
      const querySnapshot = await getDocs(q)
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data()
        setFoundId(userData.userId)
        setShowIdPopup(true)
      } else {
        setErrorMsg('등록되지 않은 휴대폰 번호입니다.')
        setShowErrorPopup(true)
      }
    } catch (error) {
      setErrorMsg('조회 중 오류가 발생했습니다: ' + error.message)
      setShowErrorPopup(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handleFindPw = async (e) => {
    e.preventDefault()
    setIsSearching(true)
    setShowPwSuccess(false)
    
    try {
      const q = query(
        collection(db, "users"), 
        where("userId", "==", userIdInput),
        where("phone", "==", phone)
      )
      const querySnapshot = await getDocs(q)
      
      if (!querySnapshot.empty) {
        setShowPwSuccess(true)
      } else {
        setErrorMsg('아이디 또는 휴대폰 번호가 일치하지 않습니다.')
        setShowErrorPopup(true)
      }
    } catch (error) {
      setErrorMsg('조회 중 오류가 발생했습니다: ' + error.message)
      setShowErrorPopup(true)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="find-account-container">
      <header className="find-account-header">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="header-title">ID/PW 찾기</h1>
        <div className="header-logo">일당백 (Day100)</div>
      </header>

      <main className="find-account-main">
        <div className="tab-rail">
          <button 
            className={`tab-btn ${activeTab === 'find-id' ? 'active' : ''}`}
            onClick={() => {setActiveTab('find-id'); setShowPwSuccess(false)}}
          >
            아이디 찾기
          </button>
          <button 
            className={`tab-btn ${activeTab === 'find-pw' ? 'active' : ''}`}
            onClick={() => {setActiveTab('find-pw'); setShowPwSuccess(false)}}
          >
            비밀번호 찾기
          </button>
        </div>

        {activeTab === 'find-id' ? (
          <section className="form-section fade-in">
            <div className="section-title">
              <h2>가입 시 등록한<br/>휴대폰 번호를 입력해주세요.</h2>
              <p>본인 확인을 위해 필요합니다.</p>
            </div>
            <form onSubmit={handleFindId} className="account-form">
              <div className="input-field">
                <label>휴대폰 번호</label>
                <input 
                  type="tel" 
                  placeholder="'-' 없이 숫자만 입력" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-submit" disabled={isSearching}>
                {isSearching ? '조회 중...' : '아이디 찾기'}
              </button>
            </form>
          </section>
        ) : (
          <section className="form-section fade-in">
            <form onSubmit={handleFindPw} className="account-form">
              <div className="input-field">
                <label>아이디</label>
                <input 
                  type="text" 
                  placeholder="아이디를 입력해주세요" 
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  required
                />
              </div>
              <div className="input-field">
                <label>휴대폰 번호</label>
                <input 
                  type="tel" 
                  placeholder="'-' 없이 숫자만 입력" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-submit" disabled={isSearching}>
                {isSearching ? '처리 중...' : '임시 비밀번호 발급'}
              </button>
              
              {showPwSuccess && (
                <div className="status-card fade-in">
                  <span className="material-symbols-outlined success-icon">check_circle</span>
                  <p>정보가 확인되었습니다. 등록하신 연락처로 임시 비밀번호가 발송될 예정입니다. (데모 중)</p>
                </div>
              )}
            </form>
          </section>
        )}
      </main>

      {/* 아이디 찾기 성공 팝업 */}
      {showIdPopup && (
        <div className="popup-overlay fade-in">
          <div className="popup-content">
            <div className="popup-icon">
              <span className="material-symbols-outlined success">check_circle</span>
            </div>
            <h3>아이디 찾기 완료</h3>
            <p className="result-text">귀하의 아이디는 <span className="highlight">{foundId}</span> 입니다.</p>
            <div className="popup-actions">
              <button className="btn-primary" onClick={() => navigate('/')}>로그인하러 가기</button>
              <button className="btn-secondary" onClick={() => setShowIdPopup(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 에러 팝업 */}
      {showErrorPopup && (
        <div className="popup-overlay fade-in">
          <div className="popup-content">
            <div className="popup-icon">
              <span className="material-symbols-outlined error">error</span>
            </div>
            <h3>확인 불가</h3>
            <p className="result-text">{errorMsg}</p>
            <div className="popup-actions solo">
              <button className="btn-secondary" onClick={() => setShowErrorPopup(false)}>다시 시도</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FindAccount
