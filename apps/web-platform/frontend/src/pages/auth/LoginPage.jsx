import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchModelCodes, login, signup } from '../../api/auth';
import { getDefaultPathForRole, isExternalUrl } from '../../config/appTarget';
import { encodeSession, setStoredSession } from '../../utils/authStorage';

const initialLoginForm = {
  userId: '',
  password: ''
};

const initialSignupForm = {
  userId: '',
  password: '',
  userName: '',
  vehicleId: '',
  modelCode: '1'
};

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(initialLoginForm);
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [modelCodes, setModelCodes] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchModelCodes()
      .then((models) =>
        setModelCodes(models.filter((model) => Number(model.code) >= 1))
      )
      .catch(() => {
        setModelCodes([
          { code: 1, modelName: 'Model 1' },
          { code: 2, modelName: 'Model 2' },
          { code: 3, modelName: 'Model 3' },
          { code: 4, modelName: 'Model 4' }
        ]);
      });
  }, []);

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (event) => {
    const { name, value } = event.target;
    setSignupForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    setIsSubmitting(true);

    try {
      const result = await login(loginForm);
      setStoredSession(result);

      const destinationUrl = new URL(
        getDefaultPathForRole(result.role),
        window.location.origin
      );
      destinationUrl.searchParams.set('session', encodeSession(result));

      if (isExternalUrl(destinationUrl.toString())) {
        window.location.assign(destinationUrl.toString());
        return;
      }

      navigate(
        `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`
      );
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    setIsSubmitting(true);

    try {
      const result = await signup(signupForm);
      setSuccessMessage(
        `${result.message} Your member number is ${result.user.id}. Please sign in.`
      );
      setSignupForm(initialSignupForm);
      setMode('login');
      setLoginForm((prev) => ({ ...prev, userId: signupForm.userId }));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page login-page">
      <div className="login-card auth-card">
        <div className="auth-switch">
          <button
            type="button"
            className={`auth-switch-button${mode === 'login' ? ' active' : ''}`}
            onClick={() => {
              resetMessages();
              setMode('login');
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-switch-button${mode === 'signup' ? ' active' : ''}`}
            onClick={() => {
              resetMessages();
              setMode('signup');
            }}
          >
            Sign Up
          </button>
        </div>

        <h1>{mode === 'login' ? 'Web Platform Login' : 'Web Platform Sign Up'}</h1>
        <p>
          {mode === 'login'
            ? 'Sign in from the dedicated login frontend and move to the role-specific app.'
            : 'Create a new account to access the separated user application.'}
        </p>

        {errorMessage ? <div className="auth-message error">{errorMessage}</div> : null}
        {successMessage ? (
          <div className="auth-message success">{successMessage}</div>
        ) : null}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <label>
              User ID
              <input
                type="text"
                name="userId"
                value={loginForm.userId}
                onChange={handleLoginChange}
                placeholder="Enter your user ID"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={loginForm.password}
                onChange={handleLoginChange}
                placeholder="Enter your password"
              />
            </label>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit} className="login-form">
            <label>
              User ID
              <input
                type="text"
                name="userId"
                value={signupForm.userId}
                onChange={handleSignupChange}
                placeholder="Choose a user ID"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={signupForm.password}
                onChange={handleSignupChange}
                placeholder="Choose a password"
              />
            </label>

            <label>
              User Name
              <input
                type="text"
                name="userName"
                value={signupForm.userName}
                onChange={handleSignupChange}
                placeholder="Enter your display name"
              />
            </label>

            <label>
              Vehicle ID
              <input
                type="text"
                name="vehicleId"
                value={signupForm.vehicleId}
                onChange={handleSignupChange}
                placeholder="Optional vehicle_id value"
              />
            </label>

            <label>
              Model Code
              <select
                name="modelCode"
                value={signupForm.modelCode}
                onChange={handleSignupChange}
              >
                {modelCodes.map((model) => (
                  <option key={model.code} value={model.code}>
                    {model.code} - {model.modelName}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
