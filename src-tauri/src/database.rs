use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use anyhow::{Result, anyhow};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserMeta {
    pub id: Option<i64>,
    pub master_hash: String,
    pub master_salt: String,
    pub question1: Option<String>,
    pub answer1_hash: Option<String>,
    pub answer_salt1: Option<String>,
    pub question2: Option<String>,
    pub answer2_hash: Option<String>,
    pub answer_salt2: Option<String>,
    pub question3: Option<String>,
    pub answer3_hash: Option<String>,
    pub answer_salt3: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PasswordEntry {
    pub id: Option<i64>,
    pub software: String,
    pub account: String,
    pub encrypted_password: String,
    pub nonce: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportData {
    pub user_meta: UserMeta,
    pub password_entries: Vec<PasswordEntry>,
}

pub struct Database {
    connection: Connection,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let connection = Connection::open(db_path)?;
        let db = Database { connection };
        db.create_tables()?;
        Ok(db)
    }

    fn create_tables(&self) -> Result<()> {
        // Create user_meta table
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS user_meta (
                id INTEGER PRIMARY KEY,
                master_hash TEXT NOT NULL,
                master_salt TEXT NOT NULL,
                question1 TEXT,
                answer1_hash TEXT,
                answer_salt1 TEXT,
                question2 TEXT,
                answer2_hash TEXT,
                answer_salt2 TEXT,
                question3 TEXT,
                answer3_hash TEXT,
                answer_salt3 TEXT
            )",
            [],
        )?;

        // Create password_entries table
        self.connection.execute(
            "CREATE TABLE IF NOT EXISTS password_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                software TEXT NOT NULL,
                account TEXT NOT NULL,
                encrypted_password TEXT NOT NULL,
                nonce TEXT NOT NULL,
                notes TEXT
            )",
            [],
        )?;

        // Add notes column if it doesn't exist (for migration)
        let _ = self.connection.execute(
            "ALTER TABLE password_entries ADD COLUMN notes TEXT",
            [],
        );

        Ok(())
    }

    // User Meta operations
    pub fn insert_user_meta(&self, user_meta: &UserMeta) -> Result<()> {
        self.connection.execute(
            "INSERT OR REPLACE INTO user_meta (
                id, master_hash, master_salt, 
                question1, answer1_hash, answer_salt1,
                question2, answer2_hash, answer_salt2,
                question3, answer3_hash, answer_salt3
            ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                user_meta.master_hash,
                user_meta.master_salt,
                user_meta.question1,
                user_meta.answer1_hash,
                user_meta.answer_salt1,
                user_meta.question2,
                user_meta.answer2_hash,
                user_meta.answer_salt2,
                user_meta.question3,
                user_meta.answer3_hash,
                user_meta.answer_salt3
            ],
        )?;
        Ok(())
    }

    pub fn get_user_meta(&self) -> Result<Option<UserMeta>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, master_hash, master_salt, 
                    question1, answer1_hash, answer_salt1,
                    question2, answer2_hash, answer_salt2,
                    question3, answer3_hash, answer_salt3
             FROM user_meta WHERE id = 1"
        )?;

        let user_meta_iter = stmt.query_map([], |row| {
            Ok(UserMeta {
                id: Some(row.get(0)?),
                master_hash: row.get(1)?,
                master_salt: row.get(2)?,
                question1: row.get(3)?,
                answer1_hash: row.get(4)?,
                answer_salt1: row.get(5)?,
                question2: row.get(6)?,
                answer2_hash: row.get(7)?,
                answer_salt2: row.get(8)?,
                question3: row.get(9)?,
                answer3_hash: row.get(10)?,
                answer_salt3: row.get(11)?,
            })
        })?;

        for user_meta in user_meta_iter {
            return Ok(Some(user_meta?));
        }
        Ok(None)
    }

    pub fn user_exists(&self) -> Result<bool> {
        let mut stmt = self.connection.prepare("SELECT COUNT(*) FROM user_meta WHERE id = 1")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        Ok(count > 0)
    }

    // Password Entry operations
    pub fn insert_password_entry(&self, entry: &PasswordEntry) -> Result<i64> {
        self.connection.execute(
            "INSERT INTO password_entries (software, account, encrypted_password, nonce, notes)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entry.software, entry.account, entry.encrypted_password, entry.nonce, entry.notes],
        )?;
        Ok(self.connection.last_insert_rowid())
    }

    pub fn get_all_password_entries(&self) -> Result<Vec<PasswordEntry>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, software, account, encrypted_password, nonce, notes FROM password_entries"
        )?;

        let entry_iter = stmt.query_map([], |row| {
            Ok(PasswordEntry {
                id: Some(row.get(0)?),
                software: row.get(1)?,
                account: row.get(2)?,
                encrypted_password: row.get(3)?,
                nonce: row.get(4)?,
                notes: row.get(5)?,
            })
        })?;

        let mut entries = Vec::new();
        for entry in entry_iter {
            entries.push(entry?);
        }
        Ok(entries)
    }

    pub fn update_password_entry(&self, entry: &PasswordEntry) -> Result<()> {
        if let Some(id) = entry.id {
            self.connection.execute(
                "UPDATE password_entries SET software = ?1, account = ?2, encrypted_password = ?3, nonce = ?4, notes = ?5 WHERE id = ?6",
                params![entry.software, entry.account, entry.encrypted_password, entry.nonce, entry.notes, id],
            )?;
        } else {
            return Err(anyhow!("Password entry ID is required for update"));
        }
        Ok(())
    }

    pub fn delete_password_entry(&self, id: i64) -> Result<()> {
        self.connection.execute("DELETE FROM password_entries WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn search_password_entries(&self, query: &str) -> Result<Vec<PasswordEntry>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, software, account, encrypted_password, nonce, notes 
             FROM password_entries 
             WHERE software LIKE ?1 OR account LIKE ?1 OR notes LIKE ?1"
        )?;

        let search_pattern = format!("%{}%", query);
        let entry_iter = stmt.query_map(params![search_pattern], |row| {
            Ok(PasswordEntry {
                id: Some(row.get(0)?),
                software: row.get(1)?,
                account: row.get(2)?,
                encrypted_password: row.get(3)?,
                nonce: row.get(4)?,
                notes: row.get(5)?,
            })
        })?;

        let mut entries = Vec::new();
        for entry in entry_iter {
            entries.push(entry?);
        }
        Ok(entries)
    }

    // Export all data
    pub fn export_all_data(&self) -> Result<ExportData> {
        let user_meta = self.get_user_meta()?
            .ok_or_else(|| anyhow!("No user data found"))?;
        let password_entries = self.get_all_password_entries()?;

        Ok(ExportData {
            user_meta,
            password_entries,
        })
    }

    // Import all data (replaces existing data)
    pub fn import_all_data(&self, data: &ExportData) -> Result<()> {
        // Start transaction
        let tx = self.connection.unchecked_transaction()?;

        // Clear existing data
        tx.execute("DELETE FROM user_meta", [])?;
        tx.execute("DELETE FROM password_entries", [])?;

        // Insert user meta
        tx.execute(
            "INSERT INTO user_meta (
                id, master_hash, master_salt, 
                question1, answer1_hash, answer_salt1,
                question2, answer2_hash, answer_salt2,
                question3, answer3_hash, answer_salt3
            ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                data.user_meta.master_hash,
                data.user_meta.master_salt,
                data.user_meta.question1,
                data.user_meta.answer1_hash,
                data.user_meta.answer_salt1,
                data.user_meta.question2,
                data.user_meta.answer2_hash,
                data.user_meta.answer_salt2,
                data.user_meta.question3,
                data.user_meta.answer3_hash,
                data.user_meta.answer_salt3
            ],
        )?;

        // Insert password entries
        for entry in &data.password_entries {
            tx.execute(
                "INSERT INTO password_entries (software, account, encrypted_password, nonce, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![entry.software, entry.account, entry.encrypted_password, entry.nonce, entry.notes],
            )?;
        }

        tx.commit()?;
        Ok(())
    }
} 