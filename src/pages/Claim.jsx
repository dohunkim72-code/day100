import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, db, storage } from '../firebase'
import { collection, addDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'
import BottomNav from '../components/BottomNav'
import './Claim.css'

const Claim = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  
  // Form States
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0])
  const [siteName, setSiteName] = useState('')
  const [poom, setPoom] = useState(1)
  const [expenseType, setExpenseType] = useState('meal')
  const [amount, setAmount] = useState('')
  const [otherDetails, setOtherDetails] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  // 요일 구하기 함수
  const getDayOfWeek = (dateStr) => {
    if (!dateStr) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
      } else {
        alert('로그인이 필요한 페이지입니다.')
        navigate('/')
      }
    })
    return () => unsubscribe()
  }, [navigate])

  const handleSave = async () => {
    if (!siteName) return alert('현장명을 입력해주세요.')
    if (!user) return alert('로그인 정보가 없습니다.')
    
    setIsLoading(true)
    try {
      let receiptUrl = '';
      
      // 1. 영수증 업로드 (있는 경우)
      if (receipt) {
        const receiptRef = ref(storage, `claims/${user.uid}/receipt_${Date.now()}`);
        const snapshot = await uploadBytes(receiptRef, receipt);
        receiptUrl = await getDownloadURL(snapshot.ref);
      }

      // 2. Firestore 저장
      await addDoc(collection(db, "claims"), {
        uid: user.uid,
        workDate: workDate,
        siteName: siteName,
        poom: poom,
        expenseType: expenseType,
        otherDetails: expenseType === 'other' ? otherDetails : '',
        amount: Number(amount) || 0,
        receiptUrl: receiptUrl,
        status: 'pending', // 관리자 승인 대기
        createdAt: new Date().toISOString()
      });

      alert('근무 기록 및 경비 청구가 완료되었습니다!')
      navigate('/history')
    } catch (error) {
      console.error("Save error:", error)
      alert('저장 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="claim-container fade-in">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="header-title">일당백 (Day100)</h1>
        </div>
        <button className="btn-save" onClick={handleSave} disabled={isLoading}>
          {isLoading ? '...' : '저장'}
        </button>
      </header>

      <main className="claim-main">
        {/* 근무 기록 섹션 */}
        <section className="form-card">
          <h2 className="card-label">근무 기록</h2>
          <div className="field">
            <label>근무 날짜</label>
            <div className="date-input-container">
              <input 
                type="date" 
                value={workDate} 
                onChange={(e) => setWorkDate(e.target.value)} 
                className="hidden-date-input"
                id="workDate"
              />
              <div className="custom-date-display">
                <div className="date-content">
                  <span className="date-text">{workDate}</span>
                  <span className="day-text">({getDayOfWeek(workDate)})</span>
                </div>
                <span className="material-symbols-outlined calendar-icon">calendar_month</span>
              </div>
            </div>
          </div>
          <div className="field">
            <label>현장명</label>
            <input 
              type="text" 
              placeholder="현장 이름을 입력하세요" 
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
          </div>
          <div className="field">
            <label>공수 (Poom)</label>
            <div className="poom-selector">
              {[1, 1.5, 2, 2.5, 3].map(val => (
                <button 
                  key={val}
                  type="button"
                  className={`poom-btn ${poom === val ? 'active' : ''}`}
                  onClick={() => setPoom(val)}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 경비 청구 섹션 */}
        <section className="form-card">
          <h2 className="card-label">경비 청구</h2>
          <div className="field">
            <label>경비 항목</label>
            <div className="expense-grid">
              {['meal', 'transport', 'fuel', 'other'].map(type => (
                <label key={type} className={`expense-option ${expenseType === type ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="expense-type" 
                    value={type}
                    checked={expenseType === type}
                    onChange={() => setExpenseType(type)}
                  />
                  <span>
                    {type === 'meal' ? '식비' : type === 'transport' ? '교통비' : type === 'fuel' ? '유류비' : '기타'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {expenseType === 'other' && (
            <div className="field fade-in">
              <label>기타 항목 상세</label>
              <input 
                type="text" 
                placeholder="어떤 경비인가요?" 
                value={otherDetails}
                onChange={(e) => setOtherDetails(e.target.value)}
              />
            </div>
          )}

          <div className="field">
            <label>금액 (원)</label>
            <div className="amount-input">
              <input 
                type="number" 
                placeholder="0" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="currency">₩</span>
            </div>
          </div>

          <div className="field">
            <label>영수증 첨부</label>
            <label className={`receipt-box ${receipt ? 'has-file' : ''}`}>
              <span className="material-symbols-outlined">
                {receipt ? 'check_circle' : 'add_a_photo'}
              </span>
              <p>{receipt ? '영수증이 첨부되었습니다' : '사진 촬영 또는 파일 업로드'}</p>
              <input 
                type="file" 
                hidden 
                onChange={(e) => setReceipt(e.target.files[0])} 
              />
            </label>
          </div>
        </section>

        <div className="bottom-action-area">
          <button className="btn-full-save" onClick={handleSave} disabled={isLoading}>
            {isLoading ? '저장 중...' : '기록 저장하기'}
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

export default Claim
