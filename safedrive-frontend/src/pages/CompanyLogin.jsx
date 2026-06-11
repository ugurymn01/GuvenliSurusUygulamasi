import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function CompanyLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login-company', { email, password });
      const { token, company } = res.data;
      // Şirket kullanıcısı: role 'company', adı navbar/başlık için username olarak da tutulur
      login(token, {
        role: 'company',
        companyId: company.id,
        name: company.name,
        username: company.name
      });
      toast.success('Giriş başarılı');
      navigate('/company');
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş yapılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <Logo size={26} />
        </div>
        <div className="login-title">Şirket girişi</div>
        <div className="login-sub">Filo takip panelinize giriş yapın</div>

        <div className="form-group">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sirket@lojistik.com"
            required
          />
        </div>

        <div className="form-group">
          <label>Şifre</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? 'Giriş yapılıyor...' : 'Şirket Girişi'}
        </button>

        {error && <div className="error-msg">{error}</div>}
      </form>
    </div>
  );
}
