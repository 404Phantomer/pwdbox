use crate::database::{Database, PasswordEntry};
use crate::crypto::CryptoService;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Serialize, Deserialize)]
pub struct AddPasswordRequest {
    pub software: String,
    pub account: String,
    pub password: String,
    pub master_key: String, // Base64 encoded master key
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdatePasswordRequest {
    pub id: i64,
    pub software: String,
    pub account: String,
    pub password: String,
    pub master_key: String, // Base64 encoded master key
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeletePasswordRequest {
    pub id: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetPasswordsRequest {
    pub master_key: String, // Base64 encoded master key
    pub search_query: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DecryptPasswordRequest {
    pub id: i64,
    pub master_key: String, // Base64 encoded master key
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasswordEntryResponse {
    pub id: i64,
    pub software: String,
    pub account: String,
    pub password: Option<String>, // Only included when specifically requested and decrypted
    pub created_at: Option<String>, // Could be added later
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasswordResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

pub struct PasswordService {
    database: Database,
}

impl PasswordService {
    pub fn new(database: Database) -> Self {
        PasswordService { database }
    }

    // Decode master key from base64
    fn decode_master_key(&self, master_key_b64: &str) -> Result<[u8; 32]> {
        let key_bytes = general_purpose::STANDARD.decode(master_key_b64)?;
        if key_bytes.len() != 32 {
            return Err(anyhow!("Invalid master key length"));
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(key)
    }

    // Add a new password entry
    pub fn add_password(&self, request: AddPasswordRequest) -> Result<PasswordResponse> {
        // Decode master key
        let master_key = self.decode_master_key(&request.master_key)?;

        // Encrypt the password
        let (encrypted_password, nonce) = CryptoService::encrypt_password(&request.password, &master_key)?;

        // Create password entry
        let entry = PasswordEntry {
            id: None,
            software: request.software,
            account: request.account,
            encrypted_password,
            nonce,
        };

        // Save to database
        let entry_id = self.database.insert_password_entry(&entry)?;

        Ok(PasswordResponse {
            success: true,
            message: "Password added successfully".to_string(),
            data: Some(serde_json::json!({"id": entry_id})),
        })
    }

    // Get all password entries (without decrypting passwords)
    pub fn get_all_passwords(&self, request: GetPasswordsRequest) -> Result<PasswordResponse> {
        let entries = if let Some(query) = request.search_query {
            self.database.search_password_entries(&query)?
        } else {
            self.database.get_all_password_entries()?
        };

        let response_entries: Vec<PasswordEntryResponse> = entries
            .into_iter()
            .map(|entry| PasswordEntryResponse {
                id: entry.id.unwrap_or(0),
                software: entry.software,
                account: entry.account,
                password: None, // Don't include encrypted password in list view
                created_at: None,
            })
            .collect();

        Ok(PasswordResponse {
            success: true,
            message: "Passwords retrieved successfully".to_string(),
            data: Some(serde_json::to_value(response_entries)?),
        })
    }

    // Get a specific password entry with decrypted password
    pub fn get_password(&self, request: DecryptPasswordRequest) -> Result<PasswordResponse> {
        // Get all entries and find the requested one
        let entries = self.database.get_all_password_entries()?;
        let entry = entries
            .into_iter()
            .find(|e| e.id == Some(request.id))
            .ok_or_else(|| anyhow!("Password entry not found"))?;

        // Decode master key
        let master_key = self.decode_master_key(&request.master_key)?;

        // Decrypt the password
        let decrypted_password = CryptoService::decrypt_password(
            &entry.encrypted_password,
            &entry.nonce,
            &master_key,
        )?;

        let response_entry = PasswordEntryResponse {
            id: entry.id.unwrap_or(0),
            software: entry.software,
            account: entry.account,
            password: Some(decrypted_password),
            created_at: None,
        };

        Ok(PasswordResponse {
            success: true,
            message: "Password retrieved successfully".to_string(),
            data: Some(serde_json::to_value(response_entry)?),
        })
    }

    // Update an existing password entry
    pub fn update_password(&self, request: UpdatePasswordRequest) -> Result<PasswordResponse> {
        // Check if entry exists
        let entries = self.database.get_all_password_entries()?;
        if !entries.iter().any(|e| e.id == Some(request.id)) {
            return Ok(PasswordResponse {
                success: false,
                message: "Password entry not found".to_string(),
                data: None,
            });
        }

        // Decode master key
        let master_key = self.decode_master_key(&request.master_key)?;

        // Encrypt the new password
        let (encrypted_password, nonce) = CryptoService::encrypt_password(&request.password, &master_key)?;

        // Create updated entry
        let entry = PasswordEntry {
            id: Some(request.id),
            software: request.software,
            account: request.account,
            encrypted_password,
            nonce,
        };

        // Update in database
        self.database.update_password_entry(&entry)?;

        Ok(PasswordResponse {
            success: true,
            message: "Password updated successfully".to_string(),
            data: Some(serde_json::json!({"id": request.id})),
        })
    }

    // Delete a password entry
    pub fn delete_password(&self, request: DeletePasswordRequest) -> Result<PasswordResponse> {
        // Check if entry exists
        let entries = self.database.get_all_password_entries()?;
        if !entries.iter().any(|e| e.id == Some(request.id)) {
            return Ok(PasswordResponse {
                success: false,
                message: "Password entry not found".to_string(),
                data: None,
            });
        }

        // Delete from database
        self.database.delete_password_entry(request.id)?;

        Ok(PasswordResponse {
            success: true,
            message: "Password deleted successfully".to_string(),
            data: None,
        })
    }

    // Search password entries
    pub fn search_passwords(&self, query: &str, _master_key: &str) -> Result<PasswordResponse> {
        let entries = self.database.search_password_entries(query)?;

        let response_entries: Vec<PasswordEntryResponse> = entries
            .into_iter()
            .map(|entry| PasswordEntryResponse {
                id: entry.id.unwrap_or(0),
                software: entry.software,
                account: entry.account,
                password: None, // Don't include password in search results
                created_at: None,
            })
            .collect();

        Ok(PasswordResponse {
            success: true,
            message: format!("Found {} matching passwords", response_entries.len()),
            data: Some(serde_json::to_value(response_entries)?),
        })
    }

    // Get password count
    pub fn get_password_count(&self) -> Result<PasswordResponse> {
        let entries = self.database.get_all_password_entries()?;
        let count = entries.len();

        Ok(PasswordResponse {
            success: true,
            message: "Password count retrieved successfully".to_string(),
            data: Some(serde_json::json!({"count": count})),
        })
    }

    // Validate master key by trying to decrypt a known entry
    pub fn validate_master_key(&self, master_key: &str) -> Result<bool> {
        let entries = self.database.get_all_password_entries()?;
        
        if entries.is_empty() {
            // If no entries exist, we can't validate the key, but it's not necessarily wrong
            return Ok(true);
        }

        // Try to decrypt the first entry
        let entry = &entries[0];
        let master_key_bytes = self.decode_master_key(master_key)?;

        match CryptoService::decrypt_password(&entry.encrypted_password, &entry.nonce, &master_key_bytes) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    // Re-encrypt all passwords with a new master key (for password change)
    pub fn re_encrypt_all_passwords(&self, old_master_key: &str, new_master_key: &str) -> Result<PasswordResponse> {
        let old_key = self.decode_master_key(old_master_key)?;
        let new_key = self.decode_master_key(new_master_key)?;
        
        let entries = self.database.get_all_password_entries()?;
        let mut updated_count = 0;

        for entry in entries {
            // Decrypt with old key
            let decrypted_password = CryptoService::decrypt_password(
                &entry.encrypted_password,
                &entry.nonce,
                &old_key,
            )?;

            // Encrypt with new key
            let (new_encrypted_password, new_nonce) = CryptoService::encrypt_password(&decrypted_password, &new_key)?;

            // Update entry
            let updated_entry = PasswordEntry {
                id: entry.id,
                software: entry.software,
                account: entry.account,
                encrypted_password: new_encrypted_password,
                nonce: new_nonce,
            };

            self.database.update_password_entry(&updated_entry)?;
            updated_count += 1;
        }

        Ok(PasswordResponse {
            success: true,
            message: format!("Re-encrypted {} password entries", updated_count),
            data: Some(serde_json::json!({"updated_count": updated_count})),
        })
    }
} 