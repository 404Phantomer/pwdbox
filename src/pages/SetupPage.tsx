import React, { useState } from 'react';
import { userApi, handleApiCall, secureStorage } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../contexts/LanguageContext';
import { CompactLanguageSwitcher } from '../components/LanguageSwitcher';
import Button from '../components/Button';
import Input from '../components/Input';
import type { SetupFormData } from '../types';

const SetupPage: React.FC = () => {
  const { checkSetup } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SetupFormData>({
    masterPassword: '',
    confirmPassword: '',
    question1: '',
    answer1: '',
    question2: '',
    answer2: '',
    question3: '',
    answer3: '',
  });
  const [errors, setErrors] = useState<Partial<SetupFormData>>({});
  const [isLoading, setIsLoading] = useState(false);

  const defaultQuestions = [
    t('securityQuestions.question1'),
    t('securityQuestions.question2'),
    t('securityQuestions.question3'),
    t('securityQuestions.question4'),
    t('securityQuestions.question5'),
    t('securityQuestions.question6'),
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name as keyof SetupFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<SetupFormData> = {};

    // Validate master password
    if (!formData.masterPassword) {
      newErrors.masterPassword = t('auth.passwordRequired');
    } else if (formData.masterPassword.length < 8) {
      newErrors.masterPassword = t('setup.passwordTooShort');
    }

    // Validate password confirmation
    if (formData.masterPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('setup.passwordMismatch');
    }

    // Validate security questions
    if (!formData.question1) newErrors.question1 = t('setup.questionRequired', { num: '1' });
    if (!formData.answer1) newErrors.answer1 = t('setup.answerRequired', { num: '1' });
    if (!formData.question2) newErrors.question2 = t('setup.questionRequired', { num: '2' });
    if (!formData.answer2) newErrors.answer2 = t('setup.answerRequired', { num: '2' });
    if (!formData.question3) newErrors.question3 = t('setup.questionRequired', { num: '3' });
    if (!formData.answer3) newErrors.answer3 = t('setup.answerRequired', { num: '3' });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const setupRequest = {
        master_password: formData.masterPassword,
        question1: formData.question1,
        answer1: formData.answer1,
        question2: formData.question2,
        answer2: formData.answer2,
        question3: formData.question3,
        answer3: formData.answer3,
      };

      const response = await handleApiCall(() => userApi.setupApp(setupRequest));

      if (response.success && response.master_key) {
        // Store authentication state
        secureStorage.setMasterKey(response.master_key);
        secureStorage.setAuthState(true);
        
        // Refresh auth state
        await checkSetup();
        
        // Navigate to dashboard
        window.location.hash = '/dashboard';
      } else {
        setErrors({ masterPassword: response.message });
      }
    } catch (error) {
      console.error('Setup failed:', error);
      setErrors({ 
        masterPassword: error instanceof Error ? error.message : 'Setup failed' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <CompactLanguageSwitcher />
        </div>
        
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            {t('auth.setupWelcome')}
          </h2>
          <p className="mt-2 text-gray-600">
            {t('auth.setupDesc')}
          </p>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Master Password Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('setup.createMasterPassword')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('auth.masterPassword')}
                  type="password"
                  name="masterPassword"
                  value={formData.masterPassword}
                  onChange={handleInputChange}
                  error={errors.masterPassword}
                  placeholder={t('auth.masterPasswordPlaceholder')}
                  required
                />
                <Input
                  label={t('setup.confirmPassword')}
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  error={errors.confirmPassword}
                  placeholder={t('setup.confirmPasswordPlaceholder')}
                  required
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {t('setup.passwordHint')}
              </p>
            </div>

            {/* Security Questions Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('setup.securityQuestions')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('setup.securityQuestionsDesc')}
              </p>
              
              <div className="space-y-4">
                {[1, 2, 3].map((num) => (
                  <div key={num} className="border rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-3">{t('setup.question')} {num}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('setup.chooseQuestion')}
                        </label>
                        <select
                          name={`question${num}`}
                          value={formData[`question${num}` as keyof SetupFormData] as string}
                          onChange={handleInputChange}
                          className="input-field"
                          required
                        >
                          <option value="">{t('setup.selectQuestion')}</option>
                          {defaultQuestions.map((question, index) => (
                            <option key={index} value={question}>
                              {question}
                            </option>
                          ))}
                        </select>
                        {errors[`question${num}` as keyof SetupFormData] && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors[`question${num}` as keyof SetupFormData]}
                          </p>
                        )}
                      </div>
                      <Input
                        label={t('setup.yourAnswer')}
                        type="text"
                        name={`answer${num}`}
                        value={formData[`answer${num}` as keyof SetupFormData] as string}
                        onChange={handleInputChange}
                        error={errors[`answer${num}` as keyof SetupFormData]}
                        placeholder={t('setup.answerPlaceholder')}
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                {t('auth.completeSetup')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupPage; 