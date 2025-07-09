import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { passwordApi, handleApiCall } from '../utils/api';
import Button from '../components/Button';
import Input from '../components/Input';
import type { PasswordEntry, PasswordFormData } from '../types';

const DashboardPage: React.FC = () => {
  const { state, logout } = useAuth();
  const { t } = useTranslation();
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPassword, setSelectedPassword] = useState<PasswordEntry | null>(null);
  const [showPassword, setShowPassword] = useState<number | null>(null);

  // Load passwords on mount
  useEffect(() => {
    loadPasswords();
  }, []);

  const loadPasswords = async () => {
    if (!state.masterKey) return;

    try {
      setLoading(true);
      const response = await handleApiCall(() => 
        passwordApi.getAllPasswords({
          master_key: state.masterKey!,
          search_query: searchQuery || undefined,
        })
      );

      if (response.success && response.data) {
        setPasswords(response.data);
      }
    } catch (error) {
      console.error('Failed to load passwords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!state.masterKey) return;

    try {
      setLoading(true);
      const response = await handleApiCall(() =>
        passwordApi.searchPasswords(searchQuery, state.masterKey!)
      );

      if (response.success && response.data) {
        setPasswords(response.data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPassword = async (id: number) => {
    if (!state.masterKey) return;

    try {
      const response = await handleApiCall(() =>
        passwordApi.getPassword({
          id,
          master_key: state.masterKey!,
        })
      );

      if (response.success && response.data) {
        setShowPassword(id);
        setSelectedPassword(response.data);
      }
    } catch (error) {
      console.error('Failed to decrypt password:', error);
    }
  };

  const handleDeletePassword = async (id: number) => {
    if (!confirm(t('password.deleteConfirm'))) {
      return;
    }

    try {
      const response = await handleApiCall(() =>
        passwordApi.deletePassword({ id })
      );

      if (response.success) {
        await loadPasswords();
      }
    } catch (error) {
      console.error('Failed to delete password:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('app.name')}</h1>
              <p className="text-sm text-gray-600">
                {t('dashboard.passwordsStored', { count: passwords.length })}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  // TODO: Implement export functionality
                  alert('Export feature coming soon!');
                }}
              >
                {t('common.export')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={logout}
              >
                {t('common.logout')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Add Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="flex gap-2">
                <Input
                  placeholder={t('dashboard.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <Button onClick={handleSearch}>{t('common.search')}</Button>
              </div>
            </div>
            <Button
              onClick={() => setShowAddForm(true)}
              className="sm:w-auto w-full"
            >
              {t('dashboard.addPassword')}
            </Button>
          </div>
        </div>

        {/* Password List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">{t('dashboard.loadingPasswords')}</p>
            </div>
          ) : passwords.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('dashboard.noPasswordsYet')}</h3>
              <p className="text-gray-600 mb-4">
                {t('dashboard.noPasswordsDesc')}
              </p>
              <Button onClick={() => setShowAddForm(true)}>
                {t('dashboard.addFirstPassword')}
              </Button>
            </div>
          ) : (
            passwords.map((password) => (
              <div key={password.id} className="password-item">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {password.software}
                    </h3>
                    <p className="text-gray-600">{password.account}</p>
                    {showPassword === password.id && selectedPassword?.password && (
                      <div className="mt-2 p-2 bg-gray-100 rounded border">
                        <p className="text-sm text-gray-700 font-mono">
                          {selectedPassword.password}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (showPassword === password.id) {
                          setShowPassword(null);
                          setSelectedPassword(null);
                        } else {
                          handleViewPassword(password.id);
                        }
                      }}
                    >
                      {showPassword === password.id ? t('common.hide') : t('common.view')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement edit functionality
                        alert('Edit feature coming soon!');
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeletePassword(password.id)}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Password Modal */}
      {showAddForm && (
        <AddPasswordModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            loadPasswords();
          }}
          masterKey={state.masterKey!}
        />
      )}
    </div>
  );
};

// Add Password Modal Component
interface AddPasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
  masterKey: string;
}

const AddPasswordModal: React.FC<AddPasswordModalProps> = ({
  onClose,
  onSuccess,
  masterKey,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PasswordFormData>({
    software: '',
    account: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<PasswordFormData>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name as keyof PasswordFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Partial<PasswordFormData> = {};
    if (!formData.software) newErrors.software = t('password.softwareRequired');
    if (!formData.account) newErrors.account = t('password.accountRequired');
    if (!formData.password) newErrors.password = t('password.passwordRequired');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await handleApiCall(() =>
        passwordApi.addPassword({
          software: formData.software,
          account: formData.account,
          password: formData.password,
          master_key: masterKey,
        })
      );

      if (response.success) {
        onSuccess();
      } else {
        setErrors({ software: response.message });
      }
    } catch (error) {
      console.error('Failed to add password:', error);
      setErrors({ 
        software: error instanceof Error ? error.message : 'Failed to add password' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('password.addNew')}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('password.software')}
            name="software"
            value={formData.software}
            onChange={handleInputChange}
            error={errors.software}
            placeholder={t('password.softwarePlaceholder')}
            required
          />
          
          <Input
            label={t('password.account')}
            name="account"
            value={formData.account}
            onChange={handleInputChange}
            error={errors.account}
            placeholder={t('password.accountPlaceholder')}
            required
          />
          
          <Input
            label={t('password.password')}
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            error={errors.password}
            placeholder={t('password.passwordPlaceholder')}
            required
          />

          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              className="flex-1"
            >
              {t('dashboard.addPassword')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DashboardPage; 