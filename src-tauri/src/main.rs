// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod crypto;
mod user_service;
mod password_service;
mod export_service;

use database::Database;
use user_service::{UserService, SetupRequest, LoginRequest, RecoveryRequest, ResetPasswordRequest, AuthResponse, SecurityQuestion};
use password_service::{PasswordService, AddPasswordRequest, UpdatePasswordRequest, DeletePasswordRequest, GetPasswordsRequest, DecryptPasswordRequest, PasswordResponse};
use export_service::{ExportService, ExportRequest, ImportRequest, ExportResponse, ImportResponse};

use std::sync::Mutex;
use tauri::State;

// Application state
struct AppState {
    database: Mutex<Database>,
    user_service: Mutex<UserService>,
    password_service: Mutex<PasswordService>,
    export_service: Mutex<ExportService>,
}

// Initialize database and services
fn initialize_services() -> Result<AppState, Box<dyn std::error::Error>> {
    // Get app data directory
    let app_data_dir = dirs::data_dir()
        .ok_or("Could not determine app data directory")?
        .join("PwdBox");
    
    // Ensure app data directory exists
    std::fs::create_dir_all(&app_data_dir)?;
    
    // Database path
    let db_path = app_data_dir.join("pwdbox.db");
    
    // Initialize database
    let database = Database::new(db_path)?;
    
    // Initialize services
    let user_service = UserService::new(Database::new(app_data_dir.join("pwdbox.db"))?);
    let password_service = PasswordService::new(Database::new(app_data_dir.join("pwdbox.db"))?);
    let export_service = ExportService::new(Database::new(app_data_dir.join("pwdbox.db"))?);
    
    Ok(AppState {
        database: Mutex::new(database),
        user_service: Mutex::new(user_service),
        password_service: Mutex::new(password_service),
        export_service: Mutex::new(export_service),
    })
}

// User Management Commands
#[tauri::command]
async fn is_app_setup(state: State<'_, AppState>) -> Result<bool, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.is_app_setup().map_err(|e| e.to_string())
}

#[tauri::command]
async fn setup_app(request: SetupRequest, state: State<'_, AppState>) -> Result<AuthResponse, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.setup_app(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn login(request: LoginRequest, state: State<'_, AppState>) -> Result<AuthResponse, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.login(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_security_questions(state: State<'_, AppState>) -> Result<Vec<SecurityQuestion>, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.get_security_questions().map_err(|e| e.to_string())
}

#[tauri::command]
async fn verify_recovery_answers(request: RecoveryRequest, state: State<'_, AppState>) -> Result<bool, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.verify_recovery_answers(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn reset_master_password(request: ResetPasswordRequest, state: State<'_, AppState>) -> Result<AuthResponse, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.reset_master_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn change_master_password(current_password: String, new_password: String, state: State<'_, AppState>) -> Result<AuthResponse, String> {
    let user_service = state.user_service.lock().map_err(|e| e.to_string())?;
    user_service.change_master_password(&current_password, &new_password).map_err(|e| e.to_string())
}

// Password Management Commands
#[tauri::command]
async fn add_password(request: AddPasswordRequest, state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.add_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_all_passwords(request: GetPasswordsRequest, state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.get_all_passwords(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_password(request: DecryptPasswordRequest, state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.get_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_password(request: UpdatePasswordRequest, state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.update_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_password(request: DeletePasswordRequest, state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.delete_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_passwords(query: String, master_key: String, state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.search_passwords(&query, &master_key).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_password_count(state: State<'_, AppState>) -> Result<PasswordResponse, String> {
    let password_service = state.password_service.lock().map_err(|e| e.to_string())?;
    password_service.get_password_count().map_err(|e| e.to_string())
}

// Export/Import Commands
#[tauri::command]
async fn export_data(request: ExportRequest, state: State<'_, AppState>) -> Result<ExportResponse, String> {
    let export_service = state.export_service.lock().map_err(|e| e.to_string())?;
    export_service.export_data(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_data(request: ImportRequest, state: State<'_, AppState>) -> Result<ImportResponse, String> {
    let export_service = state.export_service.lock().map_err(|e| e.to_string())?;
    export_service.import_data(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn preview_import(request: ImportRequest, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let export_service = state.export_service.lock().map_err(|e| e.to_string())?;
    export_service.preview_import(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_backup(export_passphrase: String, backup_path: Option<String>, state: State<'_, AppState>) -> Result<ExportResponse, String> {
    let export_service = state.export_service.lock().map_err(|e| e.to_string())?;
    export_service.create_backup(&export_passphrase, backup_path.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn validate_export_file(file_path: String, passphrase: String, state: State<'_, AppState>) -> Result<bool, String> {
    let export_service = state.export_service.lock().map_err(|e| e.to_string())?;
    export_service.validate_export_file(&file_path, &passphrase).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_export_info(file_path: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let export_service = state.export_service.lock().map_err(|e| e.to_string())?;
    export_service.get_export_info(&file_path).map_err(|e| e.to_string())
}

// Utility Commands
#[tauri::command]
async fn get_app_data_dir() -> Result<String, String> {
    let app_data_dir = dirs::data_dir()
        .ok_or("Could not determine app data directory")?
        .join("PwdBox");
    
    Ok(app_data_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_default_backup_dir() -> Result<String, String> {
    let home_dir = dirs::home_dir()
        .ok_or("Could not determine home directory")?
        .join("PwdBox_Backups");
    
    Ok(home_dir.to_string_lossy().to_string())
}

fn main() {
    // Initialize services
    let app_state = initialize_services().expect("Failed to initialize application services");

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // User management
            is_app_setup,
            setup_app,
            login,
            get_security_questions,
            verify_recovery_answers,
            reset_master_password,
            change_master_password,
            // Password management
            add_password,
            get_all_passwords,
            get_password,
            update_password,
            delete_password,
            search_passwords,
            get_password_count,
            // Export/Import
            export_data,
            import_data,
            preview_import,
            create_backup,
            validate_export_file,
            get_export_info,
            // Utilities
            get_app_data_dir,
            get_default_backup_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} 