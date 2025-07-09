import { invoke } from '@tauri-apps/api/core';
import type {
  SetupRequest,
  LoginRequest,
  RecoveryRequest,
  ResetPasswordRequest,
  AuthResponse,
  SecurityQuestion,
  AddPasswordRequest,
  UpdatePasswordRequest,
  DeletePasswordRequest,
  GetPasswordsRequest,
  DecryptPasswordRequest,
  PasswordResponse,
  ExportRequest,
  ImportRequest,
  ExportResponse,
  ImportResponse,
} from '../types';

// User Management API
export const userApi = {
  async isAppSetup(): Promise<boolean> {
    return await invoke('is_app_setup');
  },

  async setupApp(request: SetupRequest): Promise<AuthResponse> {
    return await invoke('setup_app', { request });
  },

  async login(request: LoginRequest): Promise<AuthResponse> {
    return await invoke('login', { request });
  },

  async getSecurityQuestions(): Promise<SecurityQuestion[]> {
    return await invoke('get_security_questions');
  },

  async verifyRecoveryAnswers(request: RecoveryRequest): Promise<boolean> {
    return await invoke('verify_recovery_answers', { request });
  },

  async resetMasterPassword(request: ResetPasswordRequest): Promise<AuthResponse> {
    return await invoke('reset_master_password', { request });
  },

  async changeMasterPassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
    return await invoke('change_master_password', { 
      currentPassword, 
      newPassword 
    });
  },
};

// Password Management API
export const passwordApi = {
  async addPassword(request: AddPasswordRequest): Promise<PasswordResponse> {
    return await invoke('add_password', { request });
  },

  async getAllPasswords(request: GetPasswordsRequest): Promise<PasswordResponse> {
    return await invoke('get_all_passwords', { request });
  },

  async getPassword(request: DecryptPasswordRequest): Promise<PasswordResponse> {
    return await invoke('get_password', { request });
  },

  async updatePassword(request: UpdatePasswordRequest): Promise<PasswordResponse> {
    return await invoke('update_password', { request });
  },

  async deletePassword(request: DeletePasswordRequest): Promise<PasswordResponse> {
    return await invoke('delete_password', { request });
  },

  async searchPasswords(query: string, masterKey: string): Promise<PasswordResponse> {
    return await invoke('search_passwords', { query, masterKey });
  },

  async getPasswordCount(): Promise<PasswordResponse> {
    return await invoke('get_password_count');
  },
};

// Export/Import API
export const exportApi = {
  async exportData(request: ExportRequest): Promise<ExportResponse> {
    return await invoke('export_data', { request });
  },

  async importData(request: ImportRequest): Promise<ImportResponse> {
    return await invoke('import_data', { request });
  },

  async previewImport(request: ImportRequest): Promise<any> {
    return await invoke('preview_import', { request });
  },

  async createBackup(exportPassphrase: string, backupPath?: string): Promise<ExportResponse> {
    return await invoke('create_backup', { 
      exportPassphrase, 
      backupPath: backupPath || null 
    });
  },

  async validateExportFile(filePath: string, passphrase: string): Promise<boolean> {
    return await invoke('validate_export_file', { filePath, passphrase });
  },

  async getExportInfo(filePath: string): Promise<any> {
    return await invoke('get_export_info', { filePath });
  },
};

// Utility API
export const utilityApi = {
  async getAppDataDir(): Promise<string> {
    return await invoke('get_app_data_dir');
  },

  async getDefaultBackupDir(): Promise<string> {
    return await invoke('get_default_backup_dir');
  },
};

// Error handling utility
export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Wrapper function to handle API errors consistently
export async function handleApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API call failed:', error);
    if (typeof error === 'string') {
      throw new ApiError(error);
    } else if (error instanceof Error) {
      throw new ApiError(error.message);
    } else {
      throw new ApiError('An unknown error occurred');
    }
  }
}

// Validation utilities
export const validation = {
  validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return { isValid: false, message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number' };
    }
    return { isValid: true };
  },

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  validateRequired(value: string, fieldName: string): { isValid: boolean; message?: string } {
    if (!value || value.trim().length === 0) {
      return { isValid: false, message: `${fieldName} is required` };
    }
    return { isValid: true };
  },

  validatePasswordMatch(password: string, confirmPassword: string): { isValid: boolean; message?: string } {
    if (password !== confirmPassword) {
      return { isValid: false, message: 'Passwords do not match' };
    }
    return { isValid: true };
  },
};

// Local storage utilities for secure key management
export const secureStorage = {
  setMasterKey(key: string): void {
    // In a real app, you might want to encrypt this or use a more secure method
    // For now, we'll use sessionStorage which clears on browser close
    sessionStorage.setItem('masterKey', key);
  },

  getMasterKey(): string | null {
    return sessionStorage.getItem('masterKey');
  },

  clearMasterKey(): void {
    sessionStorage.removeItem('masterKey');
  },

  setAuthState(isAuthenticated: boolean): void {
    sessionStorage.setItem('isAuthenticated', String(isAuthenticated));
  },

  getAuthState(): boolean {
    return sessionStorage.getItem('isAuthenticated') === 'true';
  },

  clearAuthState(): void {
    sessionStorage.removeItem('isAuthenticated');
  },

  clearAll(): void {
    this.clearMasterKey();
    this.clearAuthState();
  },
}; 