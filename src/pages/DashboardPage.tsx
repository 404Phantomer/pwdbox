import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { passwordApi, exportApi, handleApiCall } from '../utils/api';
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
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingPassword, setEditingPassword] = useState<PasswordEntry | null>(null);
  const [selectedPassword, setSelectedPassword] = useState<PasswordEntry | null>(null);
  const [showPassword, setShowPassword] = useState<number | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedPasswordId, setCopiedPasswordId] = useState<number | null>(null);

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

  const handleEditPassword = async (password: PasswordEntry) => {
    if (!state.masterKey) return;

    try {
      // Get decrypted password data first
      const response = await handleApiCall(() =>
        passwordApi.getPassword({
          id: password.id,
          master_key: state.masterKey!,
        })
      );

      if (response.success && response.data) {
        setEditingPassword(response.data);
        setShowEditForm(true);
      }
    } catch (error) {
      console.error('Failed to load password for editing:', error);
    }
  };

  const handleCopyPassword = async (passwordId: number, passwordText: string) => {
    try {
      await navigator.clipboard.writeText(passwordText);
      setCopiedPasswordId(passwordId);
      
      // 1.5秒后清除复制状态
      setTimeout(() => {
        setCopiedPasswordId(null);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy password:', error);
      // 如果复制失败，可以显示一个错误提示
      alert('复制失败，请手动选择密码文本');
    }
  };

  const handleDeletePassword = async (id: number) => {
    console.log('Delete button clicked for password ID:', id);
    
    const confirmed = confirm(t('password.deleteConfirm'));
    console.log('User confirmed deletion:', confirmed);
    
    if (!confirmed) {
      return;
    }

    try {
      console.log('Attempting to delete password...');
      const response = await handleApiCall(() =>
        passwordApi.deletePassword({ id })
      );

      console.log('Delete response:', response);
      
      if (response.success) {
        console.log('Password deleted successfully, reloading passwords...');
        await loadPasswords();
      } else {
        console.error('Delete failed with message:', response.message);
        alert(`删除失败: ${response.message}`);
      }
    } catch (error) {
      console.error('Failed to delete password:', error);
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
                onClick={() => setShowExportModal(true)}
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
                    {password.notes && (
                      <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium">{t('password.notes')}:</span> {password.notes}
                      </p>
                    )}
                    {showPassword === password.id && selectedPassword?.password && (
                      <div className="mt-2 p-2 bg-gray-100 rounded border">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-700 font-mono flex-1 mr-2">
                            {selectedPassword.password}
                          </p>
                          <button
                            onClick={() => handleCopyPassword(password.id, selectedPassword.password || '')}
                            className={`transition-colors p-1 rounded flex items-center space-x-1 ${
                              copiedPasswordId === password.id 
                                ? 'text-green-500' 
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                            title={t('password.copyPassword')}
                          >
                            {copiedPasswordId === password.id ? (
                              <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-xs">{t('password.copied')}</span>
                              </>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
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
                      onClick={() => handleEditPassword(password)}
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

      {/* Edit Password Modal */}
      {showEditForm && editingPassword && (
        <EditPasswordModal
          password={editingPassword}
          onClose={() => {
            setShowEditForm(false);
            setEditingPassword(null);
          }}
          onSuccess={() => {
            setShowEditForm(false);
            setEditingPassword(null);
            loadPasswords();
          }}
          masterKey={state.masterKey!}
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
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
    notes: '',
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
          notes: formData.notes,
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

          <Input
            label={t('password.notes')}
            name="notes"
            value={formData.notes || ''}
            onChange={handleInputChange}
            placeholder={t('password.notesPlaceholder')}
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

// Edit Password Modal Component
interface EditPasswordModalProps {
  password: PasswordEntry;
  onClose: () => void;
  onSuccess: () => void;
  masterKey: string;
}

const EditPasswordModal: React.FC<EditPasswordModalProps> = ({
  password,
  onClose,
  onSuccess,
  masterKey,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PasswordFormData>({
    software: password.software,
    account: password.account,
    password: password.password || '',
    notes: password.notes || '',
  });
  const [errors, setErrors] = useState<Partial<PasswordFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);

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
        passwordApi.updatePassword({
          id: password.id,
          software: formData.software,
          account: formData.account,
          password: formData.password,
          notes: formData.notes,
          master_key: masterKey,
        })
      );

      if (response.success) {
        onSuccess();
      } else {
        setErrors({ software: response.message });
      }
    } catch (error) {
      console.error('Failed to update password:', error);
      setErrors({ 
        software: error instanceof Error ? error.message : 'Failed to update password' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('password.edit')}</h2>
        
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
          
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {t('password.password')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPasswordField ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`input-field pr-10 ${errors.password ? 'border-red-500' : ''}`}
                placeholder={t('password.passwordPlaceholder')}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 px-3 flex items-center"
                onClick={() => setShowPasswordField(!showPasswordField)}
              >
                {showPasswordField ? (
                  // 隐藏密码图标 (眼睛关闭)
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 11-4.243-4.243m4.243 4.243L9.88 9.88" />
                  </svg>
                ) : (
                  // 显示密码图标 (眼睛睁开)
                  <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password}</p>
            )}
          </div>

          <Input
            label={t('password.notes')}
            name="notes"
            value={formData.notes || ''}
            onChange={handleInputChange}
            placeholder={t('password.notesPlaceholder')}
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
              {t('common.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Export Modal Component
interface ExportModalProps {
  onClose: () => void;
  masterKey: string;
}

const ExportModal: React.FC<ExportModalProps> = ({ onClose, masterKey }) => {
  const { t } = useTranslation();
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [exportPath, setExportPath] = useState('');
  const [errors, setErrors] = useState<{ passphrase?: string; confirm?: string }>({});

  const handleExport = async () => {
    // Validate inputs
    const newErrors: { passphrase?: string; confirm?: string } = {};
    if (!exportPassphrase) {
      newErrors.passphrase = t('export.passphraseRequired');
    }
    if (exportPassphrase !== confirmPassphrase) {
      newErrors.confirm = t('export.passphrasesMismatch');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await handleApiCall(() =>
        exportApi.createBackup(exportPassphrase)
      );

      if (response.success && response.file_path) {
        setExportPath(response.file_path);
        alert(`${t('export.success')}\n${t('export.savedTo')}: ${response.file_path}`);
        onClose();
      } else {
        setErrors({ passphrase: response.message || t('export.failed') });
      }
    } catch (error) {
      console.error('Export failed:', error);
      setErrors({ 
        passphrase: error instanceof Error ? error.message : t('export.failed')
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{t('export.title')}</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('export.description')}
          </p>
          
          <Input
            label={t('export.passphrase')}
            type="password"
            value={exportPassphrase}
            onChange={(e) => {
              setExportPassphrase(e.target.value);
              if (errors.passphrase) {
                setErrors(prev => ({ ...prev, passphrase: undefined }));
              }
            }}
            error={errors.passphrase}
            placeholder={t('export.passphrasePlaceholder')}
            required
          />
          
          <Input
            label={t('export.confirmPassphrase')}
            type="password"
            value={confirmPassphrase}
            onChange={(e) => {
              setConfirmPassphrase(e.target.value);
              if (errors.confirm) {
                setErrors(prev => ({ ...prev, confirm: undefined }));
              }
            }}
            error={errors.confirm}
            placeholder={t('export.confirmPassphrasePlaceholder')}
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
              onClick={handleExport}
              loading={isLoading}
              className="flex-1"
            >
              {t('common.export')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 