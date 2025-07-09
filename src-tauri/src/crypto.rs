use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::{rand_core::RngCore, SaltString}};
use base64::{Engine as _, engine::general_purpose};

use anyhow::{Result, anyhow};

pub struct CryptoService;

impl CryptoService {
    // Generate a random salt for hashing
    pub fn generate_salt() -> String {
        let mut salt = [0u8; 32];
        OsRng.fill_bytes(&mut salt);
        general_purpose::STANDARD.encode(salt)
    }

    // Hash a password using Argon2 with salt
    pub fn hash_password(password: &str, salt: &str) -> Result<String> {
        let salt_bytes = general_purpose::STANDARD.decode(salt)?;
        let salt_str = SaltString::encode_b64(&salt_bytes)
            .map_err(|e| anyhow!("Failed to encode salt: {}", e))?;

        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt_str)
            .map_err(|e| anyhow!("Failed to hash password: {}", e))?;

        Ok(password_hash.to_string())
    }

    // Verify a password against its hash
    pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| anyhow!("Failed to parse hash: {}", e))?;

        let argon2 = Argon2::default();
        match argon2.verify_password(password.as_bytes(), &parsed_hash) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    // Derive encryption key from master password
    pub fn derive_key_from_password(password: &str, salt: &str) -> Result<[u8; 32]> {
        let salt_bytes = general_purpose::STANDARD.decode(salt)?;
        if salt_bytes.len() < 16 {
            return Err(anyhow!("Salt must be at least 16 bytes"));
        }

        let argon2 = Argon2::default();
        let mut key = [0u8; 32];
        
        argon2.hash_password_into(password.as_bytes(), &salt_bytes, &mut key)
            .map_err(|e| anyhow!("Failed to derive key: {}", e))?;

        Ok(key)
    }

    // Generate a random nonce for AES-GCM
    pub fn generate_nonce() -> String {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        general_purpose::STANDARD.encode(nonce)
    }

    // Encrypt data using AES-GCM
    pub fn encrypt_data(data: &str, key: &[u8; 32], nonce_str: &str) -> Result<String> {
        let nonce_bytes = general_purpose::STANDARD.decode(nonce_str)?;
        if nonce_bytes.len() != 12 {
            return Err(anyhow!("Invalid nonce length"));
        }

        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data.as_bytes())
            .map_err(|e| anyhow!("Encryption failed: {}", e))?;

        Ok(general_purpose::STANDARD.encode(ciphertext))
    }

    // Decrypt data using AES-GCM
    pub fn decrypt_data(encrypted_data: &str, key: &[u8; 32], nonce_str: &str) -> Result<String> {
        let nonce_bytes = general_purpose::STANDARD.decode(nonce_str)?;
        if nonce_bytes.len() != 12 {
            return Err(anyhow!("Invalid nonce length"));
        }

        let ciphertext = general_purpose::STANDARD.decode(encrypted_data)?;
        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| anyhow!("Decryption failed: {}", e))?;

        String::from_utf8(plaintext)
            .map_err(|e| anyhow!("Failed to convert decrypted data to string: {}", e))
    }

    // Encrypt password entry
    pub fn encrypt_password(password: &str, master_key: &[u8; 32]) -> Result<(String, String)> {
        let nonce = Self::generate_nonce();
        let encrypted = Self::encrypt_data(password, master_key, &nonce)?;
        Ok((encrypted, nonce))
    }

    // Decrypt password entry
    pub fn decrypt_password(encrypted_password: &str, nonce: &str, master_key: &[u8; 32]) -> Result<String> {
        Self::decrypt_data(encrypted_password, master_key, nonce)
    }

    // Encrypt export data with a user-provided passphrase
    pub fn encrypt_export_data(data: &str, passphrase: &str) -> Result<String> {
        let salt = Self::generate_salt();
        let key = Self::derive_key_from_password(passphrase, &salt)?;
        let nonce = Self::generate_nonce();
        let encrypted = Self::encrypt_data(data, &key, &nonce)?;

        // Create export format: salt:nonce:encrypted_data
        let export_data = format!("{}:{}:{}", salt, nonce, encrypted);
        Ok(general_purpose::STANDARD.encode(export_data))
    }

    // Decrypt export data with a user-provided passphrase
    pub fn decrypt_export_data(encrypted_export: &str, passphrase: &str) -> Result<String> {
        let decoded = general_purpose::STANDARD.decode(encrypted_export)?;
        let export_str = String::from_utf8(decoded)?;
        
        let parts: Vec<&str> = export_str.splitn(3, ':').collect();
        if parts.len() != 3 {
            return Err(anyhow!("Invalid export data format"));
        }

        let salt = parts[0];
        let nonce = parts[1];
        let encrypted_data = parts[2];

        let key = Self::derive_key_from_password(passphrase, salt)?;
        Self::decrypt_data(encrypted_data, &key, nonce)
    }

    // Securely clear sensitive data from memory
    pub fn clear_sensitive_data(data: &mut [u8]) {
        for byte in data.iter_mut() {
            *byte = 0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hashing() {
        let password = "test_password_123";
        let salt = CryptoService::generate_salt();
        
        let hash = CryptoService::hash_password(password, &salt).unwrap();
        assert!(CryptoService::verify_password(password, &hash).unwrap());
        assert!(!CryptoService::verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_encryption_decryption() {
        let data = "sensitive_password_data";
        let salt = CryptoService::generate_salt();
        let key = CryptoService::derive_key_from_password("master_password", &salt).unwrap();
        let nonce = CryptoService::generate_nonce();

        let encrypted = CryptoService::encrypt_data(data, &key, &nonce).unwrap();
        let decrypted = CryptoService::decrypt_data(&encrypted, &key, &nonce).unwrap();

        assert_eq!(data, decrypted);
    }

    #[test]
    fn test_export_encryption() {
        let data = r#"{"test": "data"}"#;
        let passphrase = "export_passphrase";

        let encrypted = CryptoService::encrypt_export_data(data, passphrase).unwrap();
        let decrypted = CryptoService::decrypt_export_data(&encrypted, passphrase).unwrap();

        assert_eq!(data, decrypted);
    }
} 