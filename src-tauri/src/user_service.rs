use crate::database::{Database, UserMeta};
use crate::crypto::CryptoService;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SetupRequest {
    pub master_password: String,
    pub question1: String,
    pub answer1: String,
    pub question2: String,
    pub answer2: String,
    pub question3: String,
    pub answer3: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub master_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityQuestion {
    pub question: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecoveryRequest {
    pub answer1: String,
    pub answer2: String,
    pub answer3: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResetPasswordRequest {
    pub new_master_password: String,
    pub answer1: String,
    pub answer2: String,
    pub answer3: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub success: bool,
    pub message: String,
    pub master_key: Option<String>, // Base64 encoded key for frontend storage (temporary)
}

pub struct UserService {
    database: Database,
}

impl UserService {
    pub fn new(database: Database) -> Self {
        UserService { database }
    }

    // Check if the app is set up (user exists)
    pub fn is_app_setup(&self) -> Result<bool> {
        self.database.user_exists()
    }

    // Set up the app with master password and security questions
    pub fn setup_app(&self, request: SetupRequest) -> Result<AuthResponse> {
        // Check if app is already set up
        if self.is_app_setup()? {
            return Ok(AuthResponse {
                success: false,
                message: "App is already set up".to_string(),
                master_key: None,
            });
        }

        // Generate salt for master password
        let master_salt = CryptoService::generate_salt();
        let master_hash = CryptoService::hash_password(&request.master_password, &master_salt)?;

        // Generate salts and hash security question answers
        let answer_salt1 = CryptoService::generate_salt();
        let answer_salt2 = CryptoService::generate_salt();
        let answer_salt3 = CryptoService::generate_salt();

        let answer1_hash = CryptoService::hash_password(&request.answer1, &answer_salt1)?;
        let answer2_hash = CryptoService::hash_password(&request.answer2, &answer_salt2)?;
        let answer3_hash = CryptoService::hash_password(&request.answer3, &answer_salt3)?;

        // Create user meta
        let user_meta = UserMeta {
            id: None,
            master_hash,
            master_salt: master_salt.clone(),
            question1: Some(request.question1),
            answer1_hash: Some(answer1_hash),
            answer_salt1: Some(answer_salt1),
            question2: Some(request.question2),
            answer2_hash: Some(answer2_hash),
            answer_salt2: Some(answer_salt2),
            question3: Some(request.question3),
            answer3_hash: Some(answer3_hash),
            answer_salt3: Some(answer_salt3),
        };

        // Save to database
        self.database.insert_user_meta(&user_meta)?;

        // Derive master key for immediate use
        let master_key = CryptoService::derive_key_from_password(&request.master_password, &master_salt)?;
        let master_key_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, master_key);

        Ok(AuthResponse {
            success: true,
            message: "App setup completed successfully".to_string(),
            master_key: Some(master_key_b64),
        })
    }

    // Login with master password
    pub fn login(&self, request: LoginRequest) -> Result<AuthResponse> {
        // Get user meta from database
        let user_meta = self.database.get_user_meta()?
            .ok_or_else(|| anyhow!("User not found. Please set up the app first."))?;

        // Verify master password
        if !CryptoService::verify_password(&request.master_password, &user_meta.master_hash)? {
            return Ok(AuthResponse {
                success: false,
                message: "Invalid master password".to_string(),
                master_key: None,
            });
        }

        // Derive master key
        let master_key = CryptoService::derive_key_from_password(&request.master_password, &user_meta.master_salt)?;
        let master_key_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, master_key);

        Ok(AuthResponse {
            success: true,
            message: "Login successful".to_string(),
            master_key: Some(master_key_b64),
        })
    }

    // Get security questions for password recovery
    pub fn get_security_questions(&self) -> Result<Vec<SecurityQuestion>> {
        let user_meta = self.database.get_user_meta()?
            .ok_or_else(|| anyhow!("User not found"))?;

        let mut questions = Vec::new();

        if let Some(q1) = user_meta.question1 {
            questions.push(SecurityQuestion { question: q1 });
        }
        if let Some(q2) = user_meta.question2 {
            questions.push(SecurityQuestion { question: q2 });
        }
        if let Some(q3) = user_meta.question3 {
            questions.push(SecurityQuestion { question: q3 });
        }

        if questions.len() != 3 {
            return Err(anyhow!("Incomplete security questions setup"));
        }

        Ok(questions)
    }

    // Verify security question answers for password recovery
    pub fn verify_recovery_answers(&self, request: RecoveryRequest) -> Result<bool> {
        let user_meta = self.database.get_user_meta()?
            .ok_or_else(|| anyhow!("User not found"))?;

        // Verify all three answers
        let answer1_valid = match (&user_meta.answer1_hash, &user_meta.answer_salt1) {
            (Some(hash), Some(_salt)) => {
                CryptoService::verify_password(&request.answer1, hash)?
            }
            _ => false,
        };

        let answer2_valid = match (&user_meta.answer2_hash, &user_meta.answer_salt2) {
            (Some(hash), Some(_salt)) => {
                CryptoService::verify_password(&request.answer2, hash)?
            }
            _ => false,
        };

        let answer3_valid = match (&user_meta.answer3_hash, &user_meta.answer_salt3) {
            (Some(hash), Some(_salt)) => {
                CryptoService::verify_password(&request.answer3, hash)?
            }
            _ => false,
        };

        Ok(answer1_valid && answer2_valid && answer3_valid)
    }

    // Reset master password using security questions
    pub fn reset_master_password(&self, request: ResetPasswordRequest) -> Result<AuthResponse> {
        // First verify the security answers
        let recovery_request = RecoveryRequest {
            answer1: request.answer1,
            answer2: request.answer2,
            answer3: request.answer3,
        };

        if !self.verify_recovery_answers(recovery_request)? {
            return Ok(AuthResponse {
                success: false,
                message: "Invalid security answers".to_string(),
                master_key: None,
            });
        }

        // Get current user meta
        let mut user_meta = self.database.get_user_meta()?
            .ok_or_else(|| anyhow!("User not found"))?;

        // Generate new salt and hash for the new master password
        let new_master_salt = CryptoService::generate_salt();
        let new_master_hash = CryptoService::hash_password(&request.new_master_password, &new_master_salt)?;

        // Update user meta with new master password
        user_meta.master_hash = new_master_hash;
        user_meta.master_salt = new_master_salt.clone();

        // Save updated user meta
        self.database.insert_user_meta(&user_meta)?;

        // Derive new master key
        let master_key = CryptoService::derive_key_from_password(&request.new_master_password, &new_master_salt)?;
        let master_key_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, master_key);

        Ok(AuthResponse {
            success: true,
            message: "Master password reset successfully".to_string(),
            master_key: Some(master_key_b64),
        })
    }

    // Change master password (requires current password)
    pub fn change_master_password(&self, current_password: &str, new_password: &str) -> Result<AuthResponse> {
        // Verify current password first
        let login_request = LoginRequest {
            master_password: current_password.to_string(),
        };

        let auth_result = self.login(login_request)?;
        if !auth_result.success {
            return Ok(AuthResponse {
                success: false,
                message: "Current password is incorrect".to_string(),
                master_key: None,
            });
        }

        // Get current user meta
        let mut user_meta = self.database.get_user_meta()?
            .ok_or_else(|| anyhow!("User not found"))?;

        // Generate new salt and hash for the new master password
        let new_master_salt = CryptoService::generate_salt();
        let new_master_hash = CryptoService::hash_password(new_password, &new_master_salt)?;

        // Update user meta with new master password
        user_meta.master_hash = new_master_hash;
        user_meta.master_salt = new_master_salt.clone();

        // Save updated user meta
        self.database.insert_user_meta(&user_meta)?;

        // Derive new master key
        let master_key = CryptoService::derive_key_from_password(new_password, &new_master_salt)?;
        let master_key_b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, master_key);

        Ok(AuthResponse {
            success: true,
            message: "Master password changed successfully".to_string(),
            master_key: Some(master_key_b64),
        })
    }

    // Logout (for clearing sensitive data from memory)
    pub fn logout(&self) -> Result<()> {
        // In a real implementation, you might want to clear any cached sensitive data
        // For now, this is mainly a placeholder for frontend state management
        Ok(())
    }
} 