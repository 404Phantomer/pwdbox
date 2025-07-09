import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../contexts/LanguageContext';
import { CompactLanguageSwitcher } from '../components/LanguageSwitcher';
import Button from '../components/Button';
import Input from '../components/Input';

const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    masterPassword: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.masterPassword) {
      setError(t('auth.passwordRequired'));
      return;
    }

    const result = await login(formData.masterPassword);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Language Switcher */}
        <div className="flex justify-end">
          <CompactLanguageSwitcher />
        </div>
        
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {t('auth.welcome')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.welcomeDesc')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <Input
              label={t('auth.masterPassword')}
              type="password"
              name="masterPassword"
              value={formData.masterPassword}
              onChange={handleInputChange}
              placeholder={t('auth.masterPasswordPlaceholder')}
              error={error}
              required
            />
          </div>

          <div>
            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              disabled={!formData.masterPassword}
            >
              {t('auth.signIn')}
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-500"
              onClick={() => {
                // TODO: Navigate to recovery page
                alert('Password recovery feature coming soon!');
              }}
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage; 