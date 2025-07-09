use crate::database::{Database, ExportData};
use crate::crypto::CryptoService;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportRequest {
    pub export_passphrase: String,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportRequest {
    pub import_passphrase: String,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResponse {
    pub success: bool,
    pub message: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResponse {
    pub success: bool,
    pub message: String,
    pub imported_entries_count: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub version: String,
    pub created_at: String,
    pub entry_count: usize,
    pub has_user_data: bool,
}

pub struct ExportService {
    database: Database,
}

impl ExportService {
    pub fn new(database: Database) -> Self {
        ExportService { database }
    }

    // Export all data to an encrypted file
    pub fn export_data(&self, request: ExportRequest) -> Result<ExportResponse> {
        // Get all data from database
        let export_data = self.database.export_all_data()?;

        // Add metadata
        let backup_info = BackupInfo {
            version: "1.0".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            entry_count: export_data.password_entries.len(),
            has_user_data: true,
        };

        // Create complete export structure
        let complete_export = serde_json::json!({
            "backup_info": backup_info,
            "data": export_data
        });

        // Serialize to JSON
        let json_data = serde_json::to_string_pretty(&complete_export)?;

        // Encrypt the JSON data
        let encrypted_data = CryptoService::encrypt_export_data(&json_data, &request.export_passphrase)?;

        // Write to file
        let file_path = PathBuf::from(&request.file_path);
        
        // Ensure parent directory exists
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&file_path, encrypted_data)?;

        Ok(ExportResponse {
            success: true,
            message: format!("Data exported successfully to {}", request.file_path),
            file_path: Some(request.file_path),
        })
    }

    // Import data from an encrypted file
    pub fn import_data(&self, request: ImportRequest) -> Result<ImportResponse> {
        // Read encrypted file
        let file_path = PathBuf::from(&request.file_path);
        
        if !file_path.exists() {
            return Ok(ImportResponse {
                success: false,
                message: "Import file does not exist".to_string(),
                imported_entries_count: None,
            });
        }

        let encrypted_data = fs::read_to_string(&file_path)?;

        // Decrypt the data
        let json_data = CryptoService::decrypt_export_data(&encrypted_data, &request.import_passphrase)
            .map_err(|_| anyhow!("Failed to decrypt import file. Please check your passphrase."))?;

        // Parse JSON
        let import_json: serde_json::Value = serde_json::from_str(&json_data)?;

        // Extract export data
        let export_data: ExportData = if import_json.get("data").is_some() {
            // New format with metadata
            serde_json::from_value(import_json["data"].clone())?
        } else {
            // Legacy format (direct export data)
            serde_json::from_value(import_json)?
        };

        // Validate import data
        if export_data.user_meta.master_hash.is_empty() {
            return Ok(ImportResponse {
                success: false,
                message: "Invalid import data: missing user information".to_string(),
                imported_entries_count: None,
            });
        }

        let entry_count = export_data.password_entries.len();

        // Import data to database (this will replace existing data)
        self.database.import_all_data(&export_data)?;

        Ok(ImportResponse {
            success: true,
            message: format!("Data imported successfully. {} password entries restored.", entry_count),
            imported_entries_count: Some(entry_count),
        })
    }

    // Preview import file without actually importing
    pub fn preview_import(&self, request: ImportRequest) -> Result<serde_json::Value> {
        // Read encrypted file
        let file_path = PathBuf::from(&request.file_path);
        
        if !file_path.exists() {
            return Err(anyhow!("Import file does not exist"));
        }

        let encrypted_data = fs::read_to_string(&file_path)?;

        // Decrypt the data
        let json_data = CryptoService::decrypt_export_data(&encrypted_data, &request.import_passphrase)
            .map_err(|_| anyhow!("Failed to decrypt import file. Please check your passphrase."))?;

        // Parse JSON
        let import_json: serde_json::Value = serde_json::from_str(&json_data)?;

        // Extract metadata or create it
        let (backup_info, export_data) = if let Some(data) = import_json.get("data") {
            // New format with metadata
            let backup_info = import_json.get("backup_info").cloned()
                .unwrap_or_else(|| serde_json::json!({}));
            let export_data: ExportData = serde_json::from_value(data.clone())?;
            (backup_info, export_data)
        } else {
            // Legacy format
            let export_data: ExportData = serde_json::from_value(import_json)?;
            let backup_info = serde_json::json!({
                "version": "legacy",
                "entry_count": export_data.password_entries.len(),
                "has_user_data": true
            });
            (backup_info, export_data)
        };

        // Create preview
        let preview = serde_json::json!({
            "backup_info": backup_info,
            "preview": {
                "entry_count": export_data.password_entries.len(),
                "has_security_questions": export_data.user_meta.question1.is_some(),
                "entries_sample": export_data.password_entries
                    .iter()
                    .take(5)
                    .map(|entry| serde_json::json!({
                        "software": entry.software,
                        "account": entry.account
                    }))
                    .collect::<Vec<_>>()
            }
        });

        Ok(preview)
    }

    // Create a backup with specified path or default filename
    pub fn create_backup(&self, export_passphrase: &str, backup_path: Option<&str>) -> Result<ExportResponse> {
        let final_path = if let Some(path) = backup_path {
            // Use provided path directly
            PathBuf::from(path)
        } else {
            // Create default backup filename with timestamp
            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let filename = format!("pwdbox_backup_{}.enc", timestamp);
            
            // Use a default backup directory
            let home_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
            home_dir.join("PwdBox_Backups").join(filename)
        };

        let request = ExportRequest {
            export_passphrase: export_passphrase.to_string(),
            file_path: final_path.to_string_lossy().to_string(),
        };

        self.export_data(request)
    }

    // Validate an export file without importing
    pub fn validate_export_file(&self, file_path: &str, passphrase: &str) -> Result<bool> {
        let request = ImportRequest {
            import_passphrase: passphrase.to_string(),
            file_path: file_path.to_string(),
        };

        match self.preview_import(request) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    // Get export file info
    pub fn get_export_info(&self, file_path: &str) -> Result<serde_json::Value> {
        let path = PathBuf::from(file_path);
        
        if !path.exists() {
            return Err(anyhow!("File does not exist"));
        }

        let metadata = fs::metadata(&path)?;
        let modified = metadata.modified()?
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();

        Ok(serde_json::json!({
            "file_path": file_path,
            "file_size": metadata.len(),
            "modified_at": chrono::DateTime::<chrono::Utc>::from_timestamp(modified as i64, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_else(|| "unknown".to_string()),
            "exists": true
        }))
    }

    // Clean up old backup files
    pub fn cleanup_old_backups(&self, backup_dir: &str, keep_count: usize) -> Result<serde_json::Value> {
        let dir_path = PathBuf::from(backup_dir);
        
        if !dir_path.exists() {
            return Ok(serde_json::json!({
                "cleaned_count": 0,
                "message": "Backup directory does not exist"
            }));
        }

        let mut backup_files = Vec::new();
        
        for entry in fs::read_dir(&dir_path)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                    if filename.starts_with("pwdbox_backup_") && filename.ends_with(".enc") {
                        let metadata = entry.metadata()?;
                        backup_files.push((path, metadata.modified()?));
                    }
                }
            }
        }

        // Sort by modification time (newest first)
        backup_files.sort_by(|a, b| b.1.cmp(&a.1));

        // Remove old backups (keep only the specified count)
        let mut cleaned_count = 0;
        for (path, _) in backup_files.iter().skip(keep_count) {
            if fs::remove_file(path).is_ok() {
                cleaned_count += 1;
            }
        }

        Ok(serde_json::json!({
            "cleaned_count": cleaned_count,
            "remaining_count": backup_files.len().saturating_sub(cleaned_count),
            "message": format!("Cleaned up {} old backup files", cleaned_count)
        }))
    }
} 