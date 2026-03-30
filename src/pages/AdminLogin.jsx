import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import * as authPkg from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import './AdminLogin.css';

const AdminLogin = () => {
    const [adminId, setAdminId] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // 관리자 전용 이메일 포맷으로 변환
            const adminEmail = `${adminId.trim()}@day100.admin`;
            console.log("Admin login attempt:", adminEmail);
            
            const userCredential = await authPkg.signInWithEmailAndPassword(auth, adminEmail, password.trim());
            const user = userCredential.user;

            // admins 컬렉션에서 실제 관리자인지 확인
            const adminRef = doc(db, "admins", user.uid);
            const adminSnap = await getDoc(adminRef);

            if (adminSnap.exists()) {
                navigate('/admin');
            } else {
                throw new Error("관리자 권한이 없는 계정입니다. (Firestore에 등록되지 않음)");
            }
        } catch (err) {
            console.error("Login Error Details:", err);
            
            let displayMsg = "로그인 실패: ";
            if (err.code === 'auth/invalid-credential') {
                displayMsg += "아이디 또는 비밀번호가 틀렸거나, Firebase Console에서 'Email/Password' 인증이 활성화되지 않았을 수 있습니다.";
            } else if (err.code === 'auth/user-not-found') {
                displayMsg += "존재하지 않는 관리자 아이디입니다.";
            } else {
                displayMsg += err.message;
            }
            setError(displayMsg);
            
            // 권한 없는 경우 로그아웃 처리
            await auth.signOut();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="admin-login-container fade-in">
            <div className="login-box">
                <header className="login-header">
                    <h1 className="brand-logo">일당백 (Day100)</h1>
                    <p className="admin-tag">ADMINISTRATOR</p>
                </header>

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="input-group">
                        <label>ADMIN ID</label>
                        <input 
                            type="text" 
                            placeholder="관리자 아이디" 
                            value={adminId} 
                            onChange={(e) => setAdminId(e.target.value)} 
                            required 
                        />
                    </div>
                    <div className="input-group">
                        <label>PASSWORD</label>
                        <input 
                            type="password" 
                            placeholder="비밀번호" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    {error && <p className="error-msg">{error}</p>}
                    
                    <button type="submit" className="btn-login" disabled={isLoading}>
                        {isLoading ? '인증 중...' : '관리자 로그인'}
                    </button>
                </form>

                <div className="admin-footer">
                    <p className="copyright">© 2026 Day100 Corp. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
