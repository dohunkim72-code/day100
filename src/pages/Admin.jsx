import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import './Admin.css';

// 보조 앱 설정 (기존과 동일)
const firebaseConfig = {
  apiKey: "AIzaSyAA_2x_BLfF10Qd_iOrtr1kI5Lwix5rRyk",
  authDomain: "day100-web.firebaseapp.com",
  projectId: "day100-web",
  storageBucket: "day100-web.firebasestorage.app",
  messagingSenderId: "175114088761",
  appId: "1:175114088761:web:db30c4db676fd64c88f8e8"
};

const Admin = () => {
  const [activeTab, setActiveTab] = useState('users'); 
  const [users, setUsers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unitPrice, setUnitPrice] = useState(150000); 

  // 필터 상태들
  const [userFilter, setUserFilter] = useState('all'); // all, pending, rejected, approved
  const [dashboardMonth, setDashboardMonth] = useState(new Date().toISOString().slice(0, 7)); // 전역 년월 필터
  const [claimStatusFilter, setClaimStatusFilter] = useState('all'); // all, pending, approved, rejected

  // 등록/수정용 상태 (기존 유지)
  const [regId, setRegId] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [editAdmin, setEditAdmin] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPw, setEditPw] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRegForm, setShowRegForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [editUnitPrice, setEditUnitPrice] = useState(0); // 신규: 모달 내 개별 단가 수정용
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isClaimRejecting, setIsClaimRejecting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) navigate('/admin/login');
      else {
        const adminSnap = await getDoc(doc(db, "admins", currentUser.uid));
        if (!adminSnap.exists()) {
          alert("관리자 권한이 없습니다.");
          await signOut(auth);
          navigate('/admin/login');
        }
      }
    });

    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qClaims = query(collection(db, "claims"), orderBy("createdAt", "desc"));
    const unsubscribeClaims = onSnapshot(qClaims, (snapshot) => {
      setClaims(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeAdmins = onSnapshot(collection(db, "admins"), (snapshot) => {
      setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth(); unsubscribeUsers(); unsubscribeClaims(); unsubscribeAdmins();
    };
  }, [navigate]);

  // 통계 계산 로직 (요청 3 반영)
  const stats = {
    totalUsers: users.length,
    unapprovedClaims: claims.filter(c => c.status === 'pending' && c.workDate?.startsWith(dashboardMonth)).length,
    unpaidClaims: claims.filter(c => c.status === 'approved' && c.paymentStatus !== 'paid' && c.workDate?.startsWith(dashboardMonth)).length,
    totalPaidAmount: claims
      .filter(c => c.paymentStatus === 'paid' && c.workDate?.startsWith(dashboardMonth))
      .reduce((acc, curr) => {
        const currentPrice = curr.customUnitPrice || unitPrice;
        const workPay = (Number(curr.poom) || 0) * currentPrice;
        const expensePay = Number(curr.amount) || 0;
        return acc + workPay + expensePay;
      }, 0)
  };

  const handleUserAction = async (uid, newStatus, reason = '') => {
    try {
      const userRef = doc(db, "users", uid);
      const updateData = { status: newStatus };
      if (newStatus === 'rejected') updateData.rejectReason = reason;
      else if (newStatus === 'approved') updateData.rejectReason = "";
      await updateDoc(userRef, updateData);
      alert(`사용자 상태가 업데이트되었습니다.`);
      if (selectedUser?.id === uid) setSelectedUser(null);
    } catch (error) { alert('처리 실패: ' + error.message); }
  };

  const handleClaimAction = async (claimId, newStatus, reason = '') => {
    try {
      const claimRef = doc(db, "claims", claimId);
      const updateData = { status: newStatus };
      if (newStatus === 'rejected') updateData.rejectReason = reason;
      
      // 승인 시 또는 저장 시 수정된 단가 반영
      if (editUnitPrice > 0) updateData.customUnitPrice = editUnitPrice;
      
      // 승인 시 입금 대기 상태로 초기화
      if (newStatus === 'approved') updateData.paymentStatus = 'unpaid';
      
      await updateDoc(claimRef, updateData);
      alert(newStatus === 'pending' ? '정보가 저장되었습니다.' : '청구가 처리되었습니다.');
      if (newStatus !== 'pending') {
        setSelectedClaim(null);
        setIsClaimRejecting(false);
      }
    } catch (error) { alert('처리 실패: ' + error.message); }
  };

  const openClaimModal = (claim, claimant) => {
    setSelectedClaim({ ...claim, claimant });
    setEditUnitPrice(claim.customUnitPrice || unitPrice);
  };

  // 입금 처리 버튼 핸들러 (요청 4 반영)
  const handleDepositAction = async (claimId) => {
    if (!window.confirm('입금 처리를 완료하시겠습니까?')) return;
    try {
      const claimRef = doc(db, "claims", claimId);
      await updateDoc(claimRef, { paymentStatus: 'paid' });
      alert('입금이 완료 처리되었습니다.');
    } catch (error) { alert('처리 실패: ' + error.message); }
  };

  const handleLogout = async () => { await signOut(auth); navigate('/admin/login'); };

  // 관리자 계정 관리
  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const secondaryApp = getApps().find(app => app.name === 'Secondary') || initializeApp(firebaseConfig, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      const adminEmail = `${regId}@day100.admin`;
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, adminEmail, regPw);
      await setDoc(doc(db, "admins", userCredential.user.uid), {
        adminId: regId, 
        userName: regName, 
        phone: regPhone, 
        pwForAdmin: regPw, // 관리자 확인용 기록
        role: "admin", 
        createdAt: new Date().toISOString()
      });
      alert(`등록 완료!`);
      setRegId(''); setRegPw(''); setRegName(''); setRegPhone(''); setShowRegForm(false);
      await signOut(secondaryAuth);
    } catch (err) { alert("에러: " + err.message); } finally { setIsRegistering(false); }
  };

  const handleUpdateAdmin = async (e) => {
    e.preventDefault();
    if (!editAdmin) return;
    setIsUpdating(true);
    try {
      const adminRef = doc(db, "admins", editAdmin.id);
      const updateData = {
        userName: editName,
        phone: editPhone
      };
      
      // 비밀번호가 입력된 경우 추가 처리
      if (editPw.trim() !== '') {
        try {
          if (editAdmin.id === auth.currentUser?.uid) {
            // 1. 본인 비밀번호 수정 시 실제 Auth 정보 변경
            await authPkg.updatePassword(auth.currentUser, editPw);
            console.log("본인 Auth 비밀번호 동기화 성공");
            updateData.pwForAdmin = editPw; // Auth 성공 시에만 DB 업데이트 데이터에 포함
          } else {
            // 2. 타인(하위 관리자) 비밀번호 수정 시
            // 보안상 클라이언트 앱에서 타인의 이메일/비번 Auth 정보를 직접 수정하는 것은 차단됨
            alert('보안 정책상 타인의 로그인 비밀번호를 직접 수정할 수 없습니다.\n해당 계정을 삭제(준비 중) 후 다시 등록하시거나, 본인이 직접 로그인하여 수정해야 합니다.');
            setIsUpdating(false);
            return; // 동기화 보장을 위해 Firestore 업데이트 중단
          }
        } catch (err) {
          console.error("Auth sync error:", err);
          if (err.code === 'auth/requires-recent-login') {
            alert('로그인한 지 오래되어 보안상 비밀번호 변경이 차단되었습니다.\n로그아웃 후 다시 로그인하여 즉시 수정해 주세요.');
          } else {
            alert('비밀번호 변경 중 오류가 발생했습니다: ' + err.message);
          }
          setIsUpdating(false);
          return; // Auth 변경 실패 시 DB만 업데이트하지 않음 (동기화 깨짐 방지)
        }
      }
      
      await updateDoc(adminRef, updateData);
      alert(`${editAdmin.adminId} 관리자의 정보가 성공적으로 수정/저장되었습니다.`);
      setEditAdmin(null);
    } catch (err) { 
      alert("수정 실패: " + err.message); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  // 모달 열기 시 상태 초기화
  const openAdminEdit = (adm) => {
    setEditAdmin(adm);
    setEditName(adm.userName || '');
    setEditPhone(adm.phone || '');
    setEditPw('');
    setShowRegForm(false);
  };

  const handleDeleteAdmin = async (admId, admUid) => {
    if (admUid === auth.currentUser?.uid) {
      alert("본인 계정은 삭제할 수 없습니다.");
      return;
    }
    if (!window.confirm(`${admId} 관리자를 삭제하시겠습니까?`)) return;
    
    try {
      await deleteDoc(doc(db, "admins", admUid));
      alert("관리자 정보가 삭제되었습니다.\n(참고: 중복 방지를 위해 동일 아이디로 재등록 전까지는 이전 계정의 로그인 정보가 유지될 수 있습니다.)");
    } catch (err) {
      alert("삭제 실패: " + err.message);
    }
  };

  const normalizeBankName = (bank) => {
    if (!bank) return '-';
    const names = { '국민은행': 'KB국민은행', '기업은행': 'IBK기업은행', '산업은행': 'KDB산업은행', '농협': 'NH농협은행', '농협은행': 'NH농협은행', '수협': 'Sh수협은행', '수협은행': 'Sh수협은행' };
    return names[bank] || bank;
  };

  if (isLoading) return <div className="admin-loading">대시보드 구성 중...</div>;

  return (
    <div className="admin-container fade-in">
      <header className="admin-header">
        <div className="header-content">
          <h1 className="admin-title">일당백 관리자 센터</h1>
          <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
        </div>
        
        {/* 전역 년월 선택기 (요청 반영) */}
        <div className="global-filter-area">
          <div className="date-selector">
            <label className="global-label">조회 년월 선택:</label>
            <input 
              type="month" 
              className="styled-month-input primary" 
              value={dashboardMonth} 
              onChange={(e) => setDashboardMonth(e.target.value)} 
            />
          </div>
        </div>

        {/* 요청 3: 상단 통계 바 - 이제 선택된 dashboardMonth 기준입니다. */}
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-label">전체 사용자</span>
            <span className="stat-value">{stats.totalUsers}명</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{dashboardMonth} 미승인</span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.unapprovedClaims}건</span>
          </div>
          <div className="stat-card unpaid">
            <span className="stat-label">{dashboardMonth} 미입금</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{stats.unpaidClaims}건</span>
          </div>
          <div className="stat-card paid">
            <span className="stat-label">{dashboardMonth} 실지급액</span>
            <span className="stat-value">{stats.totalPaidAmount.toLocaleString()}원</span>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {/* 요청 3: 4개 탭 구조 */}
        <div className="tab-control">
          {['users', 'claims', 'deposits', 'manageAdmins'].map(tab => (
            <button key={tab} 
                    className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}>
              {tab === 'users' ? '사용자 관리' : 
               tab === 'claims' ? '청구 내역 관리' : 
               tab === 'deposits' ? '입금 관리' : '관리자 관리'}
            </button>
          ))}
        </div>

        {/* 사용자 관리 탭 (요청 1) */}
        {activeTab === 'users' && (
          <div className="view-section fade-in">
            <div className="filter-controls">
              <div className="filter-row">
                <span className="filter-label">조회 필터:</span>
                <div className="filter-tabs">
                  {[
                    {id: 'all', label: '전체'},
                    {id: 'pending', label: '미승인'},
                    {id: 'rejected', label: '반려'},
                    {id: 'approved', label: '승인'}
                  ].map(f => (
                    <button key={f.id} 
                            className={`filter-tab ${userFilter === f.id ? 'active' : ''}`}
                            onClick={() => setUserFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="data-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr><th>아이디</th><th>이름</th><th>가입일</th><th>상태</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {users.filter(u => userFilter === 'all' || u.status === userFilter).map(user => (
                    <tr key={user.id}>
                      <td>{user.userId}</td>
                      <td className="font-bold">{user.userName || '미입력'}</td>
                      <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                      <td><span className={`status-badge ${user.status || 'pending'}`}>{user.status === 'approved' ? '승인' : user.status === 'rejected' ? '반려' : '미승인'}</span></td>
                      <td className="actions"><button className="btn-action view" onClick={() => setSelectedUser(user)}>상세보기</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 청구 내역 관리 탭 (요청 2) */}
        {activeTab === 'claims' && (
          <div className="view-section fade-in">
            <div className="filter-controls">
              <div className="filter-row">
                <div className="filter-tabs">
                  {[{id: 'all', label: '전체'}, {id: 'pending', label: '대기'}, {id: 'approved', label: '승인'}, {id: 'rejected', label: '반려'}].map(f => (
                    <button key={f.id} className={`filter-tab ${claimStatusFilter === f.id ? 'active' : ''}`} onClick={() => setClaimStatusFilter(f.id)}>{f.label}</button>
                  ))}
                </div>
                <p className="helper-text">* {dashboardMonth} 근무 내역을 조회 중입니다.</p>
              </div>
            </div>
            <div className="data-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr><th>날짜</th><th>이름</th><th>현장명</th><th>공수</th><th>합계</th><th>상태</th><th>입금</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {claims.filter(c => {
                    const matchMonth = c.workDate?.startsWith(dashboardMonth);
                    const matchStatus = claimStatusFilter === 'all' || c.status === claimStatusFilter;
                    return matchMonth && matchStatus;
                  }).map(claim => {
                    const claimant = users.find(u => u.id === claim.uid);
                    const currentPrice = claim.customUnitPrice || unitPrice;
                    const totalPay = ((Number(claim.poom) || 0) * currentPrice) + (Number(claim.amount) || 0);
                    return (
                      <tr key={claim.id}>
                        <td>{claim.workDate}</td>
                        <td className="font-bold">{claimant?.userName || '-'}</td>
                        <td>{claim.siteName}</td>
                        <td className="text-center">{claim.poom}</td>
                        <td className="text-right font-bold">{totalPay.toLocaleString()}원</td>
                        <td><span className={`status-badge ${claim.status || 'pending'}`}>{claim.status === 'approved' ? '승인' : claim.status === 'pending' ? '대기' : '반려'}</span></td>
                        <td>
                          {claim.status === 'approved' ? (
                            <span className={`status-badge ${claim.paymentStatus === 'paid' ? 'paid' : 'pending'}`}>
                              {claim.paymentStatus === 'paid' ? '완료' : '대기'}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="actions">
                          <button className="btn-action view" onClick={() => openClaimModal(claim, claimant)}>상세 보기</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 입금 관리 탭 (요청 4) */}
        {activeTab === 'deposits' && (
          <div className="view-section fade-in">
            <div className="filter-controls">
              <div className="filter-row">
                <p className="helper-text">* {dashboardMonth} 승인 완료된 항목 중 미입금 내역만 표시됩니다.</p>
              </div>
            </div>
            <div className="data-table-wrapper deposit-table">
              <table className="admin-table">
                <thead>
                  <tr><th>날짜</th><th>이름</th><th>현장명</th><th>공수</th><th>일당</th><th>경비</th><th>합계</th><th>은행명</th><th>계좌번호</th><th>예금주</th><th>관리</th></tr>
                </thead>
                <tbody>
                  {claims.filter(c => {
                    const matchMonth = c.workDate?.startsWith(dashboardMonth);
                    const isApproved = c.status === 'approved';
                    const isUnpaid = c.paymentStatus !== 'paid'; // paid가 아닌 모든 상태
                    return matchMonth && isApproved && isUnpaid;
                  }).map(claim => {
                    const claimant = users.find(u => u.id === claim.uid);
                    const currentPrice = claim.customUnitPrice || unitPrice;
                    const workPay = (Number(claim.poom) || 0) * currentPrice;
                    const expensePay = Number(claim.amount) || 0;
                    return (
                      <tr key={claim.id}>
                        <td>{claim.workDate}</td>
                        <td>{claimant?.userName || '-'}</td>
                        <td>{claim.siteName}</td>
                        <td className="text-center">{claim.poom}</td>
                        <td className="text-right">{workPay.toLocaleString()}</td>
                        <td className="text-right">{expensePay.toLocaleString()}</td>
                        <td className="text-right font-bold">{ (workPay + expensePay).toLocaleString()}원</td>
                        <td>{normalizeBankName(claimant?.bank || claimant?.bankName)}</td>
                        <td>{claimant?.accountNumber || '-'}</td>
                        <td>{claimant?.accountHolder || '-'}</td>
                        <td className="actions">
                          <button className="btn-action view" onClick={() => openClaimModal(claim, claimant)}>상세 보기</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 관리자 관리 탭 */}
        {activeTab === 'manageAdmins' && (
          <div className="admin-management-view fade-in">
            <div className="section-header">
              <h2 className="section-title">관리자 계정 관리</h2>
              {!showRegForm && !editAdmin && (
                <button className="btn-action approve" onClick={() => setShowRegForm(true)}>+ 신규 등록</button>
              )}
            </div>

            {/* 신규 등록 폼 */}
            {showRegForm && (
              <div className="admin-register-section fade-in">
                <form className="register-form" onSubmit={handleRegisterAdmin}>
                  <div className="form-grid">
                    <div className="form-field"><label>ID</label><input type="text" value={regId} onChange={(e) => setRegId(e.target.value)} required /></div>
                    <div className="form-field"><label>PW</label><input type="password" value={regPw} onChange={(e) => setRegPw(e.target.value)} required /></div>
                    <div className="form-field"><label>이름</label><input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} required /></div>
                    <div className="form-field"><label>연락처</label><input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required /></div>
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="btn-action approve" disabled={isRegistering}>등록 완료</button>
                    <button type="button" className="btn-action edit" onClick={() => setShowRegForm(false)}>취소</button>
                  </div>
                </form>
              </div>
            )}


            <div className="data-table-wrapper" style={{ marginTop: '20px' }}>
              <table className="admin-table">
                <thead><tr><th>ID</th><th>이름</th><th>연락처</th><th>관리</th></tr></thead>
                <tbody>
                  {admins.map(adm => (
                    <tr key={adm.id} style={{ cursor: 'pointer' }} onClick={() => openAdminEdit(adm)}>
                      <td>{adm.adminId}</td>
                      <td className="font-bold">{adm.userName}</td>
                      <td>{adm.phone}</td>
                      <td className="actions">
                        <button className="btn-action edit" style={{ marginRight: '5px' }} onClick={(e) => { e.stopPropagation(); openAdminEdit(adm); }}>수정</button>
                        <button className="btn-action delete" onClick={async (e) => {
                          e.stopPropagation(); // 행 클릭 이벤트 중단
                          if (adm.id === auth.currentUser?.uid) return alert('본인 계정은 삭제할 수 없습니다.');
                          if (window.confirm('정말 이 관리자 계정을 삭제하시겠습니까?')) {
                            try {
                              await deleteDoc(doc(db, "admins", adm.id));
                              alert('삭제되었습니다.');
                            } catch (err) {
                              alert('처리 실패: ' + err.message);
                            }
                          }
                        }}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 관리자 수정용 모달 */}
      {editAdmin && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content fade-in" style={{ maxWidth: '600px' }}>
            <div className="modal-header"><h3>관리자 정보 수정 ({editAdmin.adminId})</h3><button className="btn-close" onClick={() => setEditAdmin(null)}>닫기</button></div>
            <div className="modal-body">
              <form className="register-form" onSubmit={handleUpdateAdmin}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="form-field"><label>이름 (성함)</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
                  <div className="form-field"><label>연락처</label><input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} required /></div>
                  <div className="form-field"><label>비밀번호 (변경 시 입력)</label><input type="password" value={editPw} onChange={(e) => setEditPw(e.target.value)} placeholder="새 비밀번호" /></div>
                </div>
                <div className="modal-footer" style={{ marginTop: '20px', padding: 0 }}>
                  <button type="submit" className="btn-action approve" disabled={isUpdating}>{isUpdating ? '저장 중...' : '수정 완료'}</button>
                  <button type="button" className="btn-action view" onClick={() => setEditAdmin(null)}>취소</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 상세 모달 (복구) */}
      {selectedUser && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content fade-in">
            <div className="modal-header"><h3>사용자 상세 및 승인</h3><button className="btn-close" onClick={() => setSelectedUser(null)}>닫기</button></div>
            <div className="modal-body">
              <div className="user-info-section">
                <div className="info-grid">
                  <div className="info-item"><label>이름</label><span>{selectedUser.userName}</span></div>
                  <div className="info-item"><label>연락처</label><span>{selectedUser.phone}</span></div>
                  <div className="info-item"><label>주민번호</label><span>{selectedUser.residentFront}-{selectedUser.residentBack || '*******'}</span></div>
                  <div className="info-item"><label>계좌</label><span>{normalizeBankName(selectedUser.bank)} {selectedUser.accountNumber} ({selectedUser.accountHolder})</span></div>
                </div>
              </div>
              <div className="document-section">
                <div className="doc-item"><h4>신분증</h4><div className="image-wrapper">{selectedUser.idCardUrl ? <img src={selectedUser.idCardUrl} alt="신분증" onClick={() => window.open(selectedUser.idCardUrl, '_blank')} /> : <p>이미지 없음</p>}</div></div>
                <div className="doc-item"><h4>통장사본</h4><div className="image-wrapper">{selectedUser.bankbookUrl ? <img src={selectedUser.bankbookUrl} alt="통장" onClick={() => window.open(selectedUser.bankbookUrl, '_blank')} /> : <p>이미지 없음</p>}</div></div>
              </div>
            </div>
            <div className="modal-footer">
              {(selectedUser.status === 'pending' || selectedUser.status === 'rejected' || !selectedUser.status) && (
                <>
                  {!isRejecting ? (
                    <>
                      <button className="btn-action approve" onClick={() => handleUserAction(selectedUser.id, 'approved')}>승인</button>
                      <button className="btn-action reject" onClick={() => setIsRejecting(true)}>반려</button>
                    </>
                  ) : (
                    <div className="rejection-panel">
                      <select value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="rejection-select">
                        <option value="">-- 사유 선택 --</option><option value="신분증 불일치">신분증 불일치</option><option value="계좌정보 불일치">계좌정보 불일치</option>
                      </select>
                      <button className="btn-action reject" onClick={() => handleUserAction(selectedUser.id, 'rejected', rejectionReason)}>최종 반려</button>
                    </div>
                  )}
                </>
              )}
              <button className="btn-action view" onClick={() => setSelectedUser(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 청구 내역 상세 보기 통합 모달 */}
      {selectedClaim && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content fade-in claim-detail-modal">
            <div className="modal-header">
              <h3>청구 내역 및 서류 확인</h3>
              <button className="btn-close" onClick={() => { setSelectedClaim(null); setIsClaimRejecting(false); }}>닫기</button>
            </div>
            <div className="modal-body">
              <div className="calculation-section summary-box">
                <h4 className="sub-section-title">정산 및 입금 정보</h4>
                <div className="info-grid">
                  <div className="info-item"><label>근무자</label><span>{selectedClaim.claimant?.userName || '-'}</span></div>
                  <div className="info-item"><label>현장명</label><span>{selectedClaim.siteName}</span></div>
                  <div className="info-item"><label>근무일자</label><span>{selectedClaim.workDate}</span></div>
                  <div className="info-item"><label>근무 공수</label><span>{selectedClaim.poom}</span></div>
                  <div className="info-item">
                    <label>단가(수정)</label>
                    {selectedClaim.status === 'pending' ? (
                      <div className="edit-price-area">
                        <input 
                          type="number" 
                          className="edit-price-input"
                          value={editUnitPrice}
                          onChange={(e) => setEditUnitPrice(Number(e.target.value))}
                        />
                        <button className="btn-small-save" onClick={() => handleClaimAction(selectedClaim.id, 'pending')}>저장</button>
                      </div>
                    ) : ( <span>{ (selectedClaim.customUnitPrice || unitPrice).toLocaleString()}원</span> )}
                  </div>
                  <div className="info-item">
                    <label>입금 상태</label>
                    <span className={`status-badge ${selectedClaim.paymentStatus === 'paid' ? 'paid' : 'pending'}`}>
                      {selectedClaim.paymentStatus === 'paid' ? '입금 완료' : 
                       selectedClaim.status === 'approved' ? '입금 대기' : '미정산'}
                    </span>
                  </div>
                  <div className="info-item"><label>경비 합계</label><span>{Number(selectedClaim.amount || 0).toLocaleString()}원</span></div>
                  <div className="info-item"><label>최종 합계</label><span className="color-primary font-bold">{(((Number(selectedClaim.poom) || 0) * (editUnitPrice || selectedClaim.customUnitPrice || unitPrice)) + (Number(selectedClaim.amount) || 0)).toLocaleString()}원</span></div>
                </div>
              </div>

              <div className="user-info-section">
                <h4>1. 경비 상세 내역</h4>
                <div className="bank-info-box expense-detail-box">
                  <p><strong>항목:</strong> {
                    selectedClaim.expenseType === 'meal' ? '식비' : 
                    selectedClaim.expenseType === 'transport' ? '교통비' : 
                    selectedClaim.expenseType === 'fuel' ? '유류비' : '기타'
                  }</p>
                  {selectedClaim.expenseType === 'other' && (
                    <p><strong>상세:</strong> <span className="highlight-text">{selectedClaim.otherDetails || '내용 없음'}</span></p>
                  )}
                  <p><strong>금액:</strong> {Number(selectedClaim.amount || 0).toLocaleString()}원</p>
                </div>
              </div>

              <div className="user-info-section">
                <h4>2. 통장 정보 (입금처)</h4>
                <div className="bank-info-box">
                  <p><strong>은행:</strong> {normalizeBankName(selectedClaim.claimant?.bank || selectedClaim.claimant?.bankName)}</p>
                  <p><strong>계좌:</strong> {selectedClaim.claimant?.accountNumber}</p>
                  <p><strong>예금주:</strong> {selectedClaim.claimant?.accountHolder}</p>
                </div>
              </div>

              <div className="user-info-section">
                <h4>3. 증빙 서류 확인</h4>
                <div className="document-section">
                  <div className="doc-item">
                    <h4>통장 사본</h4>
                    <div className="image-wrapper full-image">
                      {selectedClaim.claimant?.bankbookUrl ? 
                        <img src={selectedClaim.claimant.bankbookUrl} alt="통장사본" onClick={() => window.open(selectedClaim.claimant.bankbookUrl, '_blank')} /> 
                        : <p className="no-data">등록된 통장 이미지 없음</p>}
                    </div>
                  </div>
                  <div className="doc-item">
                    <h4>경비 영수증</h4>
                    <div className="image-wrapper full-image">
                      {selectedClaim.receiptUrl ? 
                        <img src={selectedClaim.receiptUrl} alt="영수증" onClick={() => window.open(selectedClaim.receiptUrl, '_blank')} /> 
                        : <p className="no-data">첨부된 영수증 없음</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {selectedClaim.status === 'pending' && (
                <>
                  {!isClaimRejecting ? (
                    <>
                      <button className="btn-action approve" onClick={() => handleClaimAction(selectedClaim.id, 'approved')}>서류 확인 및 승인</button>
                      <button className="btn-action reject" onClick={() => setIsClaimRejecting(true)}>서류 부적합 반려</button>
                    </>
                  ) : (
                    <div className="rejection-panel">
                      <select className="rejection-select" onChange={(e) => handleClaimAction(selectedClaim.id, 'rejected', e.target.value)}>
                        <option value="">-- 반려 사유 선택 --</option>
                        <option value="영수증 불분명 또는 누락">영수증 불분명 또는 누락</option>
                        <option value="공수 및 현장정보 불일치">공수 및 현장정보 불일치</option>
                        <option value="기타 사유">기타 사유</option>
                      </select>
                      <button className="btn-action view" onClick={() => setIsClaimRejecting(false)}>취소</button>
                    </div>
                  )}
                </>
              )}
              {selectedClaim.status === 'approved' && selectedClaim.paymentStatus !== 'paid' && (
                <button className="btn-action approve" onClick={() => { handleDepositAction(selectedClaim.id); setSelectedClaim(null); }}>최종 입금 처리</button>
              )}
              <button className="btn-action view" onClick={() => { setSelectedClaim(null); setIsClaimRejecting(false); }}>창 닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
