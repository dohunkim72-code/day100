import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import './Admin.css';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('users'); 
  const [users, setUsers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // 보안: 관리자 권한 체크 (단순히 특정 이메일로 체크하거나 로직 추가 가능)
      if (!currentUser) {
        navigate('/');
      }
    });

    // 사용자 목록 실시간 감시
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userList);
    });

    // 청구 내역 실시간 감시 (최신순)
    const qClaims = query(collection(db, "claims"), orderBy("createdAt", "desc"));
    const unsubscribeClaims = onSnapshot(qClaims, (snapshot) => {
      const claimList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClaims(claimList);
      setIsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
      unsubscribeClaims();
    };
  }, [navigate]);

  const handleUserAction = async (uid, newStatus) => {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { status: newStatus });
      alert(`사용자 상태가 ${newStatus === 'approved' ? '승인' : '변경'}되었습니다.`);
    } catch (error) {
      alert('상태 변경 실패: ' + error.message);
    }
  };

  const handleClaimAction = async (claimId, newStatus) => {
    try {
      const claimRef = doc(db, "claims", claimId);
      await updateDoc(claimRef, { status: newStatus });
    } catch (error) {
      alert('청구 처리 실패: ' + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  // 통계 계산
  const stats = {
    totalUsers: users.length,
    pendingClaims: claims.filter(c => c.status === 'pending').length,
    monthlyTotal: claims
      .filter(c => c.status === 'approved')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
  };

  if (isLoading) return <div className="admin-loading">데이터 동기화 중...</div>;

  return (
    <div className="admin-container fade-in">
      <header className="admin-header">
        <div className="header-content">
          <h1 className="admin-title">관리자 대시보드</h1>
          <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
        </div>
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.totalUsers}</span>
            <span className="stat-label">전체 사용자</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.pendingClaims}</span>
            <span className="stat-label">미승인 청구</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.monthlyTotal.toLocaleString()}원</span>
            <span className="stat-label">총 지급액 (승인 기준)</span>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <div className="tab-control">
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            사용자 관리
          </button>
          <button 
            className={`tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('claims')}
          >
            청구 내역 관리
          </button>
        </div>

        <section className="list-section">
          {activeTab === 'users' ? (
            <div className="data-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>아이디</th>
                    <th>이름(예금주)</th>
                    <th>가입일</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.userId}</td>
                      <td>{user.accountHolder || '이름없음'}</td>
                      <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                      <td>
                        <span className={`status-badge ${user.status}`}>
                          {user.status === 'approved' ? '승인됨' : '대기중'}
                        </span>
                      </td>
                      <td className="actions">
                        {user.status === 'pending' ? (
                          <button className="btn-action approve" onClick={() => handleUserAction(user.id, 'approved')}>승인하기</button>
                        ) : (
                          <button className="btn-action view" onClick={() => window.open(user.idCardUrl, '_blank')}>서류확인</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>현장명</th>
                    <th>금액</th>
                    <th>상태</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map(claim => (
                    <tr key={claim.id}>
                      <td>{claim.workDate}</td>
                      <td>{claim.siteName}</td>
                      <td>{(Number(claim.amount) || 0).toLocaleString()}원</td>
                      <td>
                        <span className={`status-badge ${claim.status}`}>
                          {claim.status === 'approved' ? '승인' : claim.status === 'pending' ? '대기' : '반려'}
                        </span>
                      </td>
                      <td className="actions">
                        {claim.status === 'pending' && (
                          <>
                            <button className="btn-action approve" onClick={() => handleClaimAction(claim.id, 'approved')}>승인</button>
                            <button className="btn-action reject" onClick={() => handleClaimAction(claim.id, 'rejected')}>반려</button>
                          </>
                        )}
                        <button className="btn-action view" onClick={() => claim.receiptUrl && window.open(claim.receiptUrl, '_blank')}>영수증</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;
