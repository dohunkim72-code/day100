import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import BottomNav from '../components/BottomNav';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // State for active tab
  const [activeTab, setActiveTab] = useState('password'); 

  // Form states
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSmsSent, setIsSmsSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);

  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountHolder: '' });
  const [bankbookFile, setBankbookFile] = useState(null);

  // 1. 사용자 인증 및 데이터 로드
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUser({ uid: currentUser.uid, ...userData });
            setPhoneNumber(userData.phone || '');
            setBankForm({
              bankName: userData.bankName || '신한은행',
              accountNumber: userData.accountNumber || '',
              accountHolder: userData.accountHolder || ''
            });
          }
        } catch (error) {
          console.error("Error loading user data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. reCAPTCHA 초기화 (로딩이 끝난 후 실행되도록 분리)
  useEffect(() => {
    let verifier = null;
    
    if (!loading) {
      const element = document.getElementById('recaptcha-profile-container');
      if (element) {
        try {
          // 기존 인스턴스가 있다면 정리
          if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
          }
          
          verifier = new RecaptchaVerifier(auth, 'recaptcha-profile-container', {
            'size': 'invisible'
          });
          setRecaptchaVerifier(verifier);
          // 전역 변수도 안전을 위해 업데이트 (일부 라이브러리 연동용)
          window.recaptchaVerifier = verifier;
        } catch (error) {
          console.error("reCAPTCHA 초기화 실패:", error);
        }
      }
    }

    return () => {
      if (verifier) {
        verifier.clear();
        setRecaptchaVerifier(null);
        if (window.recaptchaVerifier === verifier) {
          window.recaptchaVerifier = null;
        }
      }
    };
  }, [loading]);

  const handlePasswordUpdate = async () => {
    if (passwordForm.next !== passwordForm.confirm) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    
    setIsUpdating(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, passwordForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.next);
      alert('비밀번호가 성공적으로 변경되었습니다.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (error) {
      console.error(error);
      alert('실패: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const requestSms = async () => {
    if (!phoneNumber) return alert('휴대폰 번호를 입력해주세요.');
    
    // 만약 초기화가 안되어 있다면 재시도
    let appVerifier = recaptchaVerifier || window.recaptchaVerifier;
    
    if (!appVerifier) {
        appVerifier = new RecaptchaVerifier(auth, 'recaptcha-profile-container', {
            'size': 'invisible'
        });
        setRecaptchaVerifier(appVerifier);
        window.recaptchaVerifier = appVerifier;
    }

    let formattedPhone = phoneNumber.replace(/-/g, '').replace(/^0/, '+82');
    
    setIsUpdating(true);
    try {
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setIsSmsSent(true);
      alert('실제 인증 문자가 발송되었습니다.');
    } catch (error) {
      console.error(error);
      alert('발송 실패: ' + error.message);
      // 에러 발생 시 reCAPTCHA 초기화 (세션 만료 등의 이슈 대응)
      if (appVerifier) {
        appVerifier.clear();
        setRecaptchaVerifier(null);
        window.recaptchaVerifier = null;
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const verifySms = async () => {
    if (!verificationCode) return alert('인증번호를 입력해주세요.');
    if (!confirmationResult) return alert('먼저 인증요청을 진행해주세요.');
    
    setIsUpdating(true);
    try {
      await confirmationResult.confirm(verificationCode);
      alert('인증되었습니다.');
      setIsPhoneVerified(true);
    } catch (error) {
      console.error(error);
      alert('인증번호가 올바르지 않습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhoneUpdate = async () => {
    if (!isPhoneVerified) return alert('먼저 번호 인증을 완료해주세요.');
    
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { phone: phoneNumber });
      alert('휴대폰 번호가 수정되었습니다.');
      setIsSmsSent(false);
      setIsPhoneVerified(false);
      setVerificationCode('');
    } catch (error) {
      alert('수정 실패: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBankUpdate = async () => {
    setIsUpdating(true);
    try {
      let bankbookUrl = user.bankbookUrl;
      if (bankbookFile) {
        const storageRef = ref(storage, `documents/${user.uid}/bankbook_${Date.now()}`);
        await uploadBytes(storageRef, bankbookFile);
        bankbookUrl = await getDownloadURL(storageRef);
      }
      await updateDoc(doc(db, "users", user.uid), {
        ...bankForm,
        bankbookUrl
      });
      alert('정보가 수정되었습니다.');
    } catch (error) {
      alert('실패: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="profile-loading">데이터 동기화 중...</div>;

  return (
    <div className="profile-container fade-in">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="header-title">정보 수정</h1>
        </div>
      </header>

      {/* reCAPTCHA 컨테이너 */}
      <div id="recaptcha-profile-container"></div>

      <main className="profile-main">
        <section className="profile-tab-menu">
          <button className={`tab-item ${activeTab === 'password' ? 'active' : ''}`} onClick={() => setActiveTab('password')}>비밀번호</button>
          <button className={`tab-item ${activeTab === 'phone' ? 'active' : ''}`} onClick={() => setActiveTab('phone')}>휴대폰</button>
          <button className={`tab-item ${activeTab === 'bank' ? 'active' : ''}`} onClick={() => setActiveTab('bank')}>정산계좌</button>
        </section>

        <div className="tab-content-area">
          {activeTab === 'password' && (
            <section className="form-section fade-in">
              <div className="input-group">
                <input className="styled-input" type="password" placeholder="현재 비밀번호" value={passwordForm.current} onChange={e => setPasswordForm({...passwordForm, current: e.target.value})} />
                <input className="styled-input" type="password" placeholder="새 비밀번호" value={passwordForm.next} onChange={e => setPasswordForm({...passwordForm, next: e.target.value})} />
                <input className="styled-input" type="password" placeholder="새 비밀번호 확인" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
              </div>
              <div className="section-action">
                <button className="btn-edit-done" disabled={isUpdating} onClick={handlePasswordUpdate}>변경하기</button>
              </div>
            </section>
          )}

          {activeTab === 'phone' && (
            <section className="form-section fade-in">
              <div className="input-row-group">
                <div className="input-with-button">
                  <input className="styled-input" type="tel" placeholder="01012345678" value={phoneNumber} onChange={e => {
                    setPhoneNumber(e.target.value);
                    setIsSmsSent(false);
                    setIsPhoneVerified(false);
                  }} />
                  <button className={`btn-inline secondary ${isSmsSent ? 'color-primary' : ''}`} onClick={requestSms} disabled={isUpdating}>
                    {isSmsSent ? '재발송' : '인증요청'}
                  </button>
                </div>
                {isSmsSent && (
                  <div className="input-with-button mt-10">
                    <input className="styled-input" type="text" placeholder="6자리 번호" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} />
                    <button className={`btn-inline secondary ${isPhoneVerified ? 'color-primary' : ''}`} onClick={verifySms} disabled={isUpdating}>
                      {isPhoneVerified ? '인증됨' : '확인'}
                    </button>
                  </div>
                )}
              </div>
              <div className="section-action">
                <button className="btn-edit-done" disabled={isUpdating || !isPhoneVerified} onClick={handlePhoneUpdate}>
                  번호 수정 완료
                </button>
              </div>
            </section>
          )}

          {activeTab === 'bank' && (
            <section className="form-section fade-in">
              <div className="account-card">
                <div className="field-unit">
                  <select className="styled-select" value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})}>
                    <option>신한은행</option>
                    <option>국민은행</option>
                    <option>카카오뱅크</option>
                    <option>토스뱅크</option>
                  </select>
                </div>
                <div className="field-unit">
                  <input className="styled-input small" type="text" placeholder="계좌번호" value={bankForm.accountNumber} onChange={e => setBankForm({...bankForm, accountNumber: e.target.value})} />
                </div>
                <div className="field-unit">
                  <input className="styled-input small" type="text" placeholder="예금주" value={bankForm.accountHolder} onChange={e => setBankForm({...bankForm, accountHolder: e.target.value})} />
                </div>
              </div>
              <div className="upload-area-wrap">
                <label className={`upload-box ${bankbookFile ? 'has-file' : ''}`}>
                  <div className="upload-text">{bankbookFile ? bankbookFile.name : '통장 사본 선택'}</div>
                  <input type="file" className="file-input" onChange={e => setBankbookFile(e.target.files[0])} />
                </label>
              </div>
              <div className="section-action">
                <button className="btn-edit-done" disabled={isUpdating} onClick={handleBankUpdate}>수정 완료</button>
              </div>
            </section>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Profile;
