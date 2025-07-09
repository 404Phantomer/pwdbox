// User Management Types
export interface SetupRequest {
  master_password: string;
  question1: string;
  answer1: string;
  question2: string;
  answer2: string;
  question3: string;
  answer3: string;
}

export interface LoginRequest {
  master_password: string;
}

export interface SecurityQuestion {
  question: string;
}

export interface RecoveryRequest {
  answer1: string;
  answer2: string;
  answer3: string;
}

export interface ResetPasswordRequest {
  new_master_password: string;
  answer1: string;
  answer2: string;
  answer3: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  master_key?: string;
}

// Password Management Types
export interface AddPasswordRequest {
  software: string;
  account: string;
  password: string;
  master_key: string;
}

export interface UpdatePasswordRequest {
  id: number;
  software: string;
  account: string;
  password: string;
  master_key: string;
}

export interface DeletePasswordRequest {
  id: number;
}

export interface GetPasswordsRequest {
  master_key: string;
  search_query?: string;
}

export interface DecryptPasswordRequest {
  id: number;
  master_key: string;
}

export interface PasswordEntry {
  id: number;
  software: string;
  account: string;
  password?: string;
  created_at?: string;
}

export interface PasswordResponse {
  success: boolean;
  message: string;
  data?: any;
}

// Export/Import Types
export interface ExportRequest {
  export_passphrase: string;
  file_path: string;
}

export interface ImportRequest {
  import_passphrase: string;
  file_path: string;
}

export interface ExportResponse {
  success: boolean;
  message: string;
  file_path?: string;
}

export interface ImportResponse {
  success: boolean;
  message: string;
  imported_entries_count?: number;
}

// App State Types
export interface AppState {
  isAuthenticated: boolean;
  masterKey: string | null;
  isSetup: boolean;
  loading: boolean;
  error: string | null;
}

export interface PasswordState {
  passwords: PasswordEntry[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
}

// Form Types
export interface LoginFormData {
  masterPassword: string;
}

export interface SetupFormData {
  masterPassword: string;
  confirmPassword: string;
  question1: string;
  answer1: string;
  question2: string;
  answer2: string;
  question3: string;
  answer3: string;
}

export interface PasswordFormData {
  software: string;
  account: string;
  password: string;
  confirmPassword?: string;
}

export interface RecoveryFormData {
  answer1: string;
  answer2: string;
  answer3: string;
}

export interface ResetPasswordFormData {
  newPassword: string;
  confirmPassword: string;
  answer1: string;
  answer2: string;
  answer3: string;
}

export interface ExportFormData {
  passphrase: string;
  confirmPassphrase: string;
  fileName: string;
}

export interface ImportFormData {
  passphrase: string;
  filePath: string;
}

// Navigation Types
export type Route = 
  | '/login'
  | '/setup'
  | '/dashboard'
  | '/add-password'
  | '/edit-password'
  | '/recovery'
  | '/export'
  | '/import'
  | '/settings';

// Utility Types
export interface ApiError {
  message: string;
  code?: string;
}

export interface NotificationState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  visible: boolean;
}

// Component Props Types
export interface PasswordItemProps {
  password: PasswordEntry;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
} 