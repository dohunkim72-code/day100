import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db } from '../firebase'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import BottomNav from '../components/BottomNav'
import './History.css'

const History = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [claims, setClaims] = useState([])
  const [selectedDate, setSelectedDate] = useState(new Date().getDate())
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)

  // Auth check & 실시간 데이터 패칭
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        
        // 해당 유저의 모든 청구 내역 실시간 감시
        const q = query(
          collection(db, "claims"), 
          where("uid", "==", currentUser.uid)
        )
        
        const unsubscribeClaims = onSnapshot(q, (snapshot) => {
          const fetchedClaims = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.id,
            ...doc.data()
          }))
          setClaims(fetchedClaims)
          setIsLoading(false)
        })

        return () => unsubscribeClaims()
      } else {
        navigate('/')
      }
    })
    return () => unsubscribeAuth()
  }, [navigate])

  // 달력 관련 변수
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i)

  // 선택된 날짜의 청구 건들만 필터링
  const selectedDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDate).padStart(2, '0')}`
  const selectedClaims = claims.filter(c => c.workDate === selectedDateString)

  // 청구가 있는 날짜 체크 (점으로 표시)
  const claimDates = claims.map(c => new Date(c.workDate).getDate())

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(1)
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(1)
  }

  const calculateDailyTotal = () => {
    return selectedClaims.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  }

  const calculateDailyUnpaid = () => {
    return selectedClaims.filter(c => c.status === 'pending').reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  }

  if (isLoading) return <div className="loading-screen">데이터 불러오는 중...</div>

  return (
    <div className="history-container fade-in">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="header-title">청구 내역</h1>
        </div>
      </header>

      <main className="history-main">
        {/* 캘린더 섹션 */}
        <section className="calendar-section">
          <div className="calendar-header">
            <h2 className="current-month">{year}년 {month + 1}월</h2>
            <div className="calendar-nav">
              <button className="btn-nav" onClick={handlePrevMonth}>
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button className="btn-nav" onClick={handleNextMonth}>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d} className="weekday">{d}</div>
            ))}
            {emptyDays.map(i => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
            {daysArray.map(day => (
              <div 
                key={day} 
                className={`calendar-day ${selectedDate === day ? 'selected' : ''}`}
                onClick={() => setSelectedDate(day)}
              >
                <span>{day}</span>
                {claimDates.includes(day) && (
                  <div className={`dot ${claims.find(c => new Date(c.workDate).getDate() === day)?.status === 'approved' ? 'approved' : 'pending'}`}></div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 선택된 날짜 상세 내역 */}
        <section className="details-section">
          <div className="details-header">
            <h3 className="details-title">{month + 1}월 {selectedDate}일 상세</h3>
            {selectedClaims.length > 0 && <span className="location-tag">{selectedClaims[0].siteName}</span>}
          </div>

          <div className="detail-cards">
            {selectedClaims.length === 0 ? (
              <div className="no-data-msg">기록이 없습니다.</div>
            ) : (
              selectedClaims.map(claim => (
                <div key={claim.id} className="detail-card">
                  <div className="card-top">
                    <div className="info">
                      <p className="type-label">
                        {claim.expenseType === 'meal' ? '식비' : 
                         claim.expenseType === 'transport' ? '교통비' : 
                         claim.expenseType === 'fuel' ? '유류비' : `기타 (${claim.otherDetails})`}
                      </p>
                      <h4 className="item-name">{claim.siteName} - {claim.poom}공수</h4>
                    </div>
                    <span className={`status-tag ${claim.status}`}>
                      {claim.status === 'approved' ? '지급완료' : claim.status === 'rejected' ? '반려됨' : '대기중'}
                    </span>
                  </div>
                  <div className="card-bottom">
                    <span className="desc">등록일: {new Date(claim.createdAt).toLocaleDateString()}</span>
                    <span className="price">{(Number(claim.amount) || 0).toLocaleString()}원</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedClaims.length > 0 && (
            <div className="summary-card">
              <div className="row">
                <span className="label">오늘의 총 청구액</span>
                <span className="val">{calculateDailyTotal().toLocaleString()}원</span>
              </div>
              <div className="row total">
                <span className="label">대기 중인 금액</span>
                <span className="val highlight">{calculateDailyUnpaid().toLocaleString()}원</span>
              </div>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  )
}

export default History
