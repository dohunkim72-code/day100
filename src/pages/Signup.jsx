import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { createUserWithEmailAndPassword, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './Signup.css';

const Signup = () => {
  const navigate = useNavigate();
  
  // States
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    confirmPassword: '',
    userName: '',
    residentFront: '',
    residentBack: '',
    phone: '',
    verificationCode: '',
    bank: '',
    accountNumber: '',
    accountHolder: ''
  });

  const [files, setFiles] = useState({
    idCard: null,
    bankbook: null
  });

  const [isIdChecked, setIsIdChecked] = useState(false);
  const [isSmsSent, setIsSmsSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);

  useEffect(() => {
    // reCAPTCHA 초기화 (보이지 않는 방식)
    let verifier = null;
    
    const initRecaptcha = () => {
      const element = document.getElementById('recaptcha-container');
      if (element) {
        try {
          // 기존 전역 변수가 있다면 정리
          if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
          }
          
          verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
              // reCAPTCHA solved
            }
          });
          setRecaptchaVerifier(verifier);
          window.recaptchaVerifier = verifier;
        } catch (error) {
          console.error("reCAPTCHA 초기화 실패:", error);
        }
      }
    };

    initRecaptcha();

    return () => {
      if (verifier) {
        verifier.clear();
        setRecaptchaVerifier(null);
        if (window.recaptchaVerifier === verifier) {
          window.recaptchaVerifier = null;
        }
      }
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'userId') setIsIdChecked(false);
    if (name === 'phone') {
      setIsSmsSent(false);
      setIsPhoneVerified(false);
    }
  };

  const validateRRN = (front, back) => {
    if (!/^\d{6}$/.test(front) || !/^\d{7}$/.test(back)) {
      return { isValid: false, message: '주민등록번호 13자리 숫자를 모두 입력해주세요.' };
    }
    const month = parseInt(front.substring(2, 4), 10);
    const day = parseInt(front.substring(4, 6), 10);
    if (month < 1 || month > 12) return { isValid: false, message: '유효하지 않은 생년월일(월)입니다.' };
    const lastDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > lastDays[month - 1]) return { isValid: false, message: '유효하지 않은 생년월일(일)입니다.' };

    const fullRRN = front + back;
    const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(fullRRN.charAt(i), 10) * weights[i];
    const checkDigit = (11 - (sum % 11)) % 10;
    if (checkDigit !== parseInt(fullRRN.charAt(12), 10)) {
      return { isValid: false, message: '올바른 주민등록번호가 아닙니다. 다시 확인해주세요.' };
    }
    return { isValid: true };
  };

  const validatePassword = (password, confirmPassword) => {
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) return { isValid: false, message: '비밀번호는 8자 이상의 영문, 숫자, 특수문자 조합이어야 합니다.' };
    if (password !== confirmPassword) return { isValid: false, message: '비밀번호가 서로 일치하지 않습니다.' };
    return { isValid: true };
  };

  const checkDuplicateId = async () => {
    if (!formData.userId) return alert('아이디를 입력해주세요.');
    setIsLoading(true);
    try {
      const q = query(collection(db, "users"), where("userId", "==", formData.userId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        alert('이미 사용 중인 아이디입니다.');
        setIsIdChecked(false);
      } else {
        alert('사용 가능한 아이디입니다.');
        setIsIdChecked(true);
      }
    } catch (error) {
      alert('아이디 체크 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 실제 문자 발송 요청
  const requestSms = async () => {
    if (!formData.phone) return alert('휴대폰 번호를 입력해주세요.');
    
    // 한국 번호 포맷팅 (01012345678 -> +821012345678)
    let formattedPhone = formData.phone.replace(/-/g, '').replace(/^0/, '+82');
    
    setIsLoading(true);
    try {
      let appVerifier = recaptchaVerifier || window.recaptchaVerifier;
      if (!appVerifier) {
        appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { 'size': 'invisible' });
        setRecaptchaVerifier(appVerifier);
        window.recaptchaVerifier = appVerifier;
      }
      
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(result);
      setIsSmsSent(true);
      alert('실제 휴대폰으로 인증번호가 발송되었습니다.');
    } catch (error) {
      console.error(error);
      alert('문자 발송 실패: ' + error.message + '\nFirebase 콘솔에서 Phone 인증이 활성화되어 있는지 확인해 주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 실제 문자 인증 확인
  const verifySms = async () => {
    if (!formData.verificationCode) return alert('인증번호를 입력해주세요.');
    if (!confirmationResult) return alert('먼저 인증요청을 진행해주세요.');
    
    setIsLoading(true);
    try {
      await confirmationResult.confirm(formData.verificationCode);
      alert('휴대폰 인증에 성공하였습니다.');
      setIsPhoneVerified(true);
    } catch (error) {
      console.error(error);
      alert('인증번호가 올바르지 않거나 만료되었습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e, key) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, [key]: e.target.files[0] }));
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const pwdValidation = validatePassword(formData.password, formData.confirmPassword);
    if (!pwdValidation.isValid) return alert(pwdValidation.message);
    const rrnValidation = validateRRN(formData.residentFront, formData.residentBack);
    if (!rrnValidation.isValid) return alert(rrnValidation.message);
    if (!isIdChecked) return alert('아이디 중복 체크를 완료해주세요.');
    if (!isPhoneVerified) return alert('휴대폰 인증을 완료해주세요.');
    if (!files.idCard || !files.bankbook) return alert('증빙 서류를 업로드해주세요.');
    
    setIsLoading(true);
    try {
      const userEmail = `${formData.userId}@day100.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, userEmail, formData.password);
      const user = userCredential.user;

      const idCardRef = ref(storage, `users/${user.uid}/idCard_${Date.now()}`);
      const bankbookRef = ref(storage, `users/${user.uid}/bankbook_${Date.now()}`);

      const idCardSnapshot = await uploadBytes(idCardRef, files.idCard);
      const bankbookSnapshot = await uploadBytes(bankbookRef, files.bankbook);

      const idCardUrl = await getDownloadURL(idCardSnapshot.ref);
      const bankbookUrl = await getDownloadURL(bankbookSnapshot.ref);

      await setDoc(doc(db, "users", user.uid), {
        userId: formData.userId,
        userName: formData.userName,
        email: userEmail,
        phone: formData.phone,
        residentFront: formData.residentFront,
        residentBack: formData.residentBack,
        bank: formData.bank,
        accountNumber: formData.accountNumber,
        accountHolder: formData.accountHolder,
        idCardUrl: idCardUrl,
        bankbookUrl: bankbookUrl,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      alert('회원가입이 완료되었습니다!');
      navigate('/');
    } catch (error) {
      alert('회원가입 중 오류: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container fade-in">
      <nav className="signup-nav-bar">
        <button className="btn-back" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="nav-title">회원가입</h1>
      </nav>

      {/* reCAPTCHA 컨테이너 (숨김 처리됨) */}
      <div id="recaptcha-container"></div>

      <main className="signup-single-main">
        <header className="signup-welcome">
          <h2 className="brand-title">일당백 (Day100)</h2>
          <p className="brand-sub">정확한 정보를 입력하여 주세요.</p>
        </header>

        <form className="signup-full-form" onSubmit={handleSignup}>
          <section className="form-group-section">
            <h3 className="section-group-label">계정 정보</h3>
            <div className="form-field">
              <label className="field-label">아이디</label>
              <div className="input-with-button">
                <input type="text" name="userId" placeholder="아이디" value={formData.userId} onChange={handleInputChange} required />
                <button type="button" disabled={isLoading} className={`btn-action-outline ${isIdChecked ? 'color-primary' : ''}`} onClick={checkDuplicateId}>
                  {isIdChecked ? '확인됨' : '중복체크'}
                </button>
              </div>
            </div>
            <div className="form-field">
              <label className="field-label">비밀번호</label>
              <input type="password" name="password" placeholder="영문/숫자/특수문자 조합 8자 이상" value={formData.password} onChange={handleInputChange} required />
            </div>
            <div className="form-field">
              <label className="field-label">비밀번호 확인</label>
              <input type="password" name="confirmPassword" placeholder="비밀번호 재입력" value={formData.confirmPassword} onChange={handleInputChange} required />
            </div>
          </section>

          <section className="form-group-section border-top">
            <h3 className="section-group-label">인적 사항</h3>
            <div className="form-field">
              <label className="field-label">성명</label>
              <input type="text" name="userName" placeholder="성함" value={formData.userName} onChange={handleInputChange} required />
            </div>
            <div className="form-field">
              <label className="field-label">주민등록번호</label>
              <div className="ssn-input-row">
                <input type="text" name="residentFront" placeholder="앞 6자리" maxLength="6" value={formData.residentFront} onChange={handleInputChange} required />
                <span className="separator">-</span>
                <input type="password" name="residentBack" placeholder="뒤 7자리" maxLength="7" value={formData.residentBack} onChange={handleInputChange} required />
              </div>
            </div>
            <div className="form-field">
              <label className="field-label">휴대폰 번호</label>
              <div className="input-with-button margin-b-10">
                <input type="tel" name="phone" placeholder="숫자만 입력" value={formData.phone} onChange={handleInputChange} required />
                <button type="button" disabled={isLoading} className={`btn-action-outline ${isSmsSent ? 'color-primary' : ''}`} onClick={requestSms}>
                  {isSmsSent ? '재발송' : '인증요청'}
                </button>
              </div>
              <div className="input-with-button">
                <input type="text" name="verificationCode" placeholder="6자리 인증번호" value={formData.verificationCode} onChange={handleInputChange} required />
                <button type="button" disabled={isLoading} className={`btn-action-outline ${isPhoneVerified ? 'color-primary' : ''}`} onClick={verifySms}>
                  {isPhoneVerified ? '인증완료' : '인증확인'}
                </button>
              </div>
            </div>
          </section>

          <section className="form-group-section border-top">
            <h3 className="section-group-label">정산 계좌</h3>
            <div className="form-field">
              <select name="bank" value={formData.bank} onChange={handleInputChange} required>
                <option value="">은행 선택</option>
                <option value="우체국">우체국</option>
                <option value="IBK기업은행">IBK기업은행</option>
                <option value="KDB산업은행">KDB산업은행</option>
                <option value="NH농협은행">NH농협은행</option>
                <option value="Sh수협은행">Sh수협은행</option>
                <option value="KB국민은행">KB국민은행</option>
                <option value="하나은행">하나은행</option>
                <option value="신한은행">신한은행</option>
                <option value="우리은행">우리은행</option>
                <option value="SC제일은행">SC제일은행</option>
                <option value="iM뱅크">iM뱅크</option>
                <option value="케이뱅크">케이뱅크</option>
                <option value="카카오뱅크">카카오뱅크</option>
                <option value="토스뱅크">토스뱅크</option>
                <option value="전북은행">전북은행</option>
                <option value="광주은행">광주은행</option>
                <option value="BNK부산은행">BNK부산은행</option>
                <option value="BNK경남은행">BNK경남은행</option>
                <option value="제주은행">제주은행</option>
                <option value="jBANK">jBANK</option>
                <option value="신협">신협</option>
                <option value="새마을금고">새마을금고</option>
                <option value="산림조합">산림조합</option>
                <option value="SBI저축은행">SBI저축은행</option>
                <option value="저축은행">저축은행</option>
              </select>
            </div>
            <div className="form-field">
              <input type="text" name="accountNumber" placeholder="계좌번호 (- 제외)" value={formData.accountNumber} onChange={handleInputChange} required />
            </div>
            <div className="form-field">
              <input type="text" name="accountHolder" placeholder="예금주" value={formData.accountHolder} onChange={handleInputChange} required />
            </div>
          </section>

          <section className="form-group-section border-top">
            <h3 className="section-group-label">증빙 서류</h3>
            <div className="upload-grid-row">
              <label className={`upload-card-box ${files.idCard ? 'uploaded' : ''}`}>
                <input type="file" className="hidden-file-input" onChange={(e) => handleFileChange(e, 'idCard')} />
                <span className="upload-status-text">{files.idCard ? '신분증 완료' : '신분증 업로드'}</span>
              </label>
              <label className={`upload-card-box ${files.bankbook ? 'uploaded' : ''}`}>
                <input type="file" className="hidden-file-input" onChange={(e) => handleFileChange(e, 'bankbook')} />
                <span className="upload-status-text">{files.bankbook ? '통장사본 완료' : '통장사본 업로드'}</span>
              </label>
            </div>
          </section>

          <div className="form-submit-area">
            <button type="submit" className="btn-signup-finish" disabled={isLoading}>
              {isLoading ? '처리 중...' : '회원가입 완료'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Signup;
