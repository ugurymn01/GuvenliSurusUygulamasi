import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';

export default function Login() {
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
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;

      // Bu panel yalnızca yöneticiler içindir
      if (user.role !== 'admin') {
        setError('Bu panel yalnızca yöneticilere özeldir. Sürücüler mobil uygulamayı kullanmalıdır.');
        return;
      }

      login(token, user);
      toast.success('Giriş başarılı');
      navigate('/admin');
    } catch (err) {
      const msg = err.response?.data?.error || 'Giriş yapılamadı';
      setError(msg);
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
        <div className="login-title">Tekrar hoş geldiniz</div>
        <div className="login-sub">Yönetici panelinize giriş yapın</div>

        <div className="form-group">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@safedrive.com"
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
          {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>

        {error && <div className="error-msg">{error}</div>}

        <div className="login-foot">
          <Link to="/company-login" className="login-link">
            Şirket girişi için tıklayın
          </Link>
        </div>
      </form>
    </div>
  );
}
